import { create } from "zustand";
import type { Chat, FailedRequest, GenerationState, Message, RateLimitNotice, StreamingSlice } from "@/types/chat";
import type { CapabilityConfig, Citation, SearchPhase } from "@/types/capabilities";
import type { ParsedAttachment } from "@/types/attachments";
import { chatRepository, chatTitleFromMessages } from "@/lib/storage/chats";
import { generateChatTitle } from "@/lib/storage/title-generator";
import { streamChatCompletion, type SSEChunk } from "@/lib/openrouter/chat";
import { buildChatRequest } from "@/lib/openrouter/request-builder";
import { isMissingModelError, refineOpenRouterError } from "@/lib/openrouter/errors";
import { isKnownModel, pickCatalogFallback, pickModelFallbacks } from "@/lib/openrouter/models";
import { cloneCapabilities, configToSnapshot, DEFAULT_CAPABILITIES, snapshotToConfig } from "@/lib/capabilities/defaults";
import { mergeCitations } from "@/lib/citations/parse";
import { buildAttachmentContext } from "@/lib/attachments";
import { buildProjectContext } from "@/lib/projects/context-builder";
import { useModelStore } from "@/store/model-store";
import { useSettingsStore } from "@/store/settings-store";
import { newId } from "@/lib/utils/ids";

/**
 * Buffer de streaming fuera del estado React: los deltas SSE se acumulan
 * aquí y se vuelcan al slice `streaming` en requestAnimationFrame.
 */
interface StreamBuffer {
  chatId: string;
  messageId: string;
  text: string;
  actualModel?: string;
  usage?: Message["usage"];
  finishReason?: string;
  citations: Citation[];
  searchPhase: SearchPhase;
  sourceCount: number;
  searchFailed: boolean;
  didWebSearch: boolean;
  dirty: boolean;
  images: Message["images"];
  audio: Message["audio"];
  video: Message["video"];
}

let buffer: StreamBuffer | null = null;
let flushRaf: number | null = null;
let aborter: AbortController | null = null;
let startedAt = 0;

export interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  generation: GenerationState;
  streaming: StreamingSlice | null;
  streamingMessageId: string | null;
  failedRequest: FailedRequest | null;
  rateLimitNotice: RateLimitNotice | null;
  sidebarOpen: boolean;
  searchQuery: string;
  hydrated: boolean;

  hydrate: (defaultModel: string) => void;
  newChat: (model: string, projectId?: string | null) => string;
  selectChat: (id: string | null) => void;
  renameChat: (id: string, title: string) => void;
  deleteChat: (id: string, fallbackModel: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
  setChatProject: (chatId: string, projectId: string | null) => void;

  send: (text: string, opts: SendOpts) => Promise<void>;
  stop: () => void;
  editAndResend: (messageId: string, text: string, opts: SendOpts) => Promise<void>;
  regenerate: (opts: SendOpts) => Promise<void>;
  retryFailed: (opts: SendOpts) => Promise<void>;
  setChatCapabilities: (chatId: string, config: CapabilityConfig) => void;
  patchChatCapabilities: (chatId: string, patch: Partial<CapabilityConfig>) => void;
  activeChat: () => Chat | undefined;
}

export function selectActiveChat(s: ChatState): Chat | undefined {
  return s.chats.find((c) => c.id === s.activeChatId);
}

export function selectStreaming(s: ChatState): StreamingSlice | null {
  return s.streaming;
}

/** Contenido visible: slice en vivo si este mensaje es el que se genera. */
export function selectMessageContent(s: ChatState, messageId: string): string | null {
  if (s.streaming?.messageId === messageId) return s.streaming.text;
  return null;
}

export interface SendOpts {
  model: string;
  apiKey: string;
  temperature: number;
  systemPrompt: string;
  siteTitle: string;
  siteReferer: string;
  /** Fallbacks OpenRouter (solo ids gratuitos). */
  fallbacks?: string[];
  capabilities?: CapabilityConfig;
  attachments?: ParsedAttachment[];
}

function toPayload(messages: Message[]): { role: Message["role"]; content: string }[] {
  return messages
    .filter((m) => m.status !== "error" && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));
}

function touchChat(chat: Chat): Chat {
  return { ...chat, updatedAt: Date.now() };
}

export const useChatStore = create<ChatState>()((set, get) => {
  function mutateChat(chatId: string, fn: (c: Chat) => Chat, persist: "now" | "soon" = "soon") {
    const repoChat = chatRepository.get(chatId);
    if (!repoChat) return;
    const next = fn(repoChat);
    chatRepository.update(next);
    if (persist === "now") {
      // update() ya persiste; persistSoon solo reprograma escritura diferida
    } else {
      chatRepository.persistSoon();
    }
    set({ chats: chatRepository.list() });
  }

  function appendUserMessage(chatId: string, text: string, attachments?: ParsedAttachment[]): Message {
    const msg: Message = {
      id: newId(),
      role: "user",
      content: text,
      status: "complete",
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      createdAt: Date.now(),
    };
    mutateChat(chatId, (c) => {
      const messages = [...c.messages, msg];
      return touchChat({ ...c, messages, title: chatTitleFromMessages(messages) });
    });
    return msg;
  }

  function appendAssistantPlaceholder(
    chatId: string,
    requestedModel: string,
    capabilities?: Message["capabilities"],
  ): Message {
    const msg: Message = {
      id: newId(),
      role: "assistant",
      content: "",
      status: "pending",
      requestedModel,
      capabilities,
      createdAt: Date.now(),
    };
    mutateChat(chatId, (c) => touchChat({ ...c, messages: [...c.messages, msg] }));
    return msg;
  }

  function patchMessage(chatId: string, messageId: string, patch: Partial<Message>) {
    mutateChat(chatId, (c) => ({
      ...c,
      messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
    }));
  }

  function startFlushLoop() {
    stopFlushLoop();
    const tick = () => {
      flushRaf = requestAnimationFrame(tick);
      if (!buffer?.dirty) return;
      buffer.dirty = false;
      const b = buffer;
      set({
        streaming: {
          chatId: b.chatId,
          messageId: b.messageId,
          text: b.text,
          searchPhase: b.searchPhase,
          sourceCount: b.sourceCount,
          searchFailed: b.searchFailed,
        },
      });
    };
    flushRaf = requestAnimationFrame(tick);
  }

  function stopFlushLoop() {
    if (flushRaf != null) cancelAnimationFrame(flushRaf);
    flushRaf = null;
  }

  /** Vuelca el buffer final al repo + estado y persiste de inmediato. */
  function commitBuffer(final: Partial<Message> = {}) {
    if (!buffer) return;
    const b = buffer;
    buffer = null;
    const repoChat = chatRepository.get(b.chatId);
    if (repoChat) {
      chatRepository.update(
        touchChat({
          ...repoChat,
          messages: repoChat.messages.map((m) =>
            m.id !== b.messageId
              ? m
              : {
                  ...m,
                  content: b.text,
                  actualModel: b.actualModel ?? m.actualModel,
                  usage: b.usage ?? m.usage,
                  finishReason: b.finishReason ?? m.finishReason,
                  elapsedMs: Date.now() - startedAt,
                  citations: b.citations.length > 0 ? b.citations : m.citations,
                  searchWarning: b.searchFailed
                    ? "No se pudo consultar Internet. La respuesta puede no contener información reciente."
                    : m.searchWarning,
                  images: b.images && b.images.length > 0 ? b.images : m.images,
                  audio: b.audio ?? m.audio,
                  video: b.video ?? m.video,
                  ...final,
                },
          ),
        }),
      );
    }
    set({ chats: chatRepository.list(), streaming: null });

    if (final.status === "complete") {
      tryAutoTitle(b.chatId);
    }
  }

  function tryAutoTitle(chatId: string) {
    const chat = chatRepository.get(chatId);
    if (!chat) return;
    const looksAuto =
      chat.title === "Nueva conversación" ||
      chat.title.startsWith("Nueva conversación") ||
      chat.title.length === 0;
    if (!looksAuto) return;
    const assistantCount = chat.messages.filter((m) => m.role === "assistant").length;
    if (assistantCount !== 1) return;

    const settings = useSettingsStore.getState();
    const apiKey = settings.apiKey || "";
    if (!apiKey) return;

    void (async () => {
      const title = await generateChatTitle(chat, {
        apiKey,
        model: useModelStore.getState().effectiveModel() || undefined,
        siteTitle: settings.siteTitle,
        siteReferer: settings.siteReferer,
      });
      if (!title) return;
      const fresh = chatRepository.get(chatId);
      if (!fresh) return;
      chatRepository.update(touchChat({ ...fresh, title }));
      set({ chats: chatRepository.list() });
    })();
  }

  /** Modelo vivo del catálogo, no el id posiblemente obsoleto de sendOpts. */
  async function resolveSendOpts(opts: SendOpts, preferRequested = false): Promise<SendOpts> {
    let live = useModelStore.getState();
    if (live.loading && live.models.length === 0) {
      await live.refresh(opts.apiKey);
      live = useModelStore.getState();
    }
    const liveEffective = live.effectiveModel();
    const requested = (opts.model ?? "").trim();
    let model = liveEffective;
    if (preferRequested && requested) {
      if (live.models.length === 0 || isKnownModel(requested, live.models)) {
        model = requested;
      }
    }
    if (
      live.models.length > 0 &&
      live.selectedModel !== model &&
      !isKnownModel(live.selectedModel, live.models)
    ) {
      live.select(model);
    }
    return {
      ...opts,
      model,
      fallbacks: pickModelFallbacks(model, live.models),
    };
  }

  async function runGeneration(
    chatId: string,
    assistantId: string,
    payloadMessages: { role: Message["role"]; content: string }[],
    opts: SendOpts,
  ) {
    aborter?.abort();
    aborter = new AbortController();
    startedAt = Date.now();
    buffer = {
      chatId,
      messageId: assistantId,
      text: "",
      citations: [],
      searchPhase: "idle",
      sourceCount: 0,
      searchFailed: false,
      didWebSearch: false,
      dirty: false,
      images: undefined,
      audio: undefined,
      video: undefined,
    };
    set({
      generation: "streaming",
      streamingMessageId: assistantId,
      failedRequest: null,
      rateLimitNotice: null,
      streaming: { chatId, messageId: assistantId, text: "", searchPhase: "idle" },
    });
    startFlushLoop();
    patchMessage(chatId, assistantId, { status: "streaming" });

    const onChunk = (chunk: SSEChunk) => {
      if (!buffer) return;
      if (chunk.content) {
        buffer.text += chunk.content;
        if (buffer.searchPhase === "searching" || buffer.searchPhase === "sources") {
          buffer.searchPhase = "writing";
        }
        buffer.dirty = true;
      }
      if (chunk.model) buffer.actualModel = chunk.model;
      if (chunk.finishReason) buffer.finishReason = chunk.finishReason;
      if (chunk.webSearch || chunk.toolCalls?.length) {
        buffer.didWebSearch = true;
        if (buffer.searchPhase === "idle") buffer.searchPhase = "searching";
        buffer.dirty = true;
      }
      if (chunk.annotations?.length) {
        buffer.citations = mergeCitations(buffer.citations, chunk.annotations);
        buffer.sourceCount = buffer.citations.length;
        if (buffer.sourceCount > 0 && buffer.searchPhase !== "writing") {
          buffer.searchPhase = "sources";
        }
        buffer.dirty = true;
      }
      if (chunk.searchError) {
        buffer.searchFailed = true;
        buffer.dirty = true;
      }
      if (chunk.images && chunk.images.length > 0) {
        buffer.images = (buffer.images ?? []).concat(chunk.images);
        buffer.dirty = true;
      }
      if (chunk.audio) {
        const prev = buffer.audio;
        if (!prev) {
          buffer.audio = {
            format: "wav",
            dataUrl: chunk.audio.data ? dataUrlFromBase64("wav", chunk.audio.data) : undefined,
            transcript: chunk.audio.transcript,
          };
        } else if (chunk.audio.data) {
          const a = prev.dataUrl ?? "";
          buffer.audio = {
            ...prev,
            dataUrl: appendBase64(a, chunk.audio.data),
            transcript: prev.transcript || chunk.audio.transcript,
          };
        } else if (chunk.audio.transcript && !prev.transcript) {
          buffer.audio = { ...prev, transcript: chunk.audio.transcript };
        }
        buffer.dirty = true;
      }
      if (chunk.video?.url) {
        buffer.video = { url: chunk.video.url };
        buffer.dirty = true;
      }
      if (chunk.usage) {
        buffer.usage = {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
          reasoningTokens: chunk.usage.completion_tokens_details?.reasoning_tokens,
          cachedTokens: chunk.usage.prompt_tokens_details?.cached_tokens,
          cost: chunk.usage.cost,
          webSearchRequests: chunk.usage.server_tool_use?.web_search_requests,
        };
        if ((chunk.usage.server_tool_use?.web_search_requests ?? 0) > 0) {
          buffer.didWebSearch = true;
          if (buffer.searchPhase === "idle") buffer.searchPhase = "searching";
        }
      }
    };

    const capabilities = opts.capabilities ?? DEFAULT_CAPABILITIES;
    const modelItem = useModelStore.getState().models.find((m) => m.id === opts.model);
    const params = buildChatRequest({
      model: opts.model,
      messages: payloadMessages,
      capabilities,
      settings: { temperature: opts.temperature, fallbacks: opts.fallbacks },
      modelItem,
    });

    const result = await streamChatCompletion(
      params,
      { apiKey: opts.apiKey, siteReferer: opts.siteReferer, siteTitle: opts.siteTitle },
      { onChunk, signal: aborter.signal },
    );

    stopFlushLoop();

    if (aborter.signal.aborted) {
      // Parada por el usuario: se conserva la respuesta parcial.
      commitBuffer({ status: "stopped", finishReason: "user_stop" });
      set({ generation: "idle", streamingMessageId: null });
      return;
    }

    if (!result.ok || result.error) {
      const models = useModelStore.getState().models;
      const err = result.error
        ? refineOpenRouterError(result.error, {
            modelId: opts.model,
            knownModel: isKnownModel(opts.model, models),
          })
        : undefined;
      const message = err?.message ?? "Error desconocido.";
      const hasPartial = (buffer?.text ?? "").length > 0;
      const isRateLimit = err?.code === 429;
      const missingModel = err ? isMissingModelError(err) : false;

      if (missingModel && models.length > 0) {
        const fallback = pickCatalogFallback(models);
        const live = useModelStore.getState();
        if (fallback && fallback !== live.selectedModel) live.select(fallback);
        live.setPickerOpen(true);
      }

      // 429 a mitad de stream: se conserva el parcial como respuesta válida
      // (status complete) y se guarda el aviso aparte para no destruir texto.
      commitBuffer(
        hasPartial
          ? { status: "complete", finishReason: "length" }
          : {
              status: "error",
              error: {
                code: err?.code,
                message,
                detail: err?.detail,
                retryable: err?.retryable,
                retryAfterMs: err?.retryAfterMs,
                provider: err?.provider,
              },
            },
      );
      set({
        generation: hasPartial || missingModel || !err?.retryable ? "idle" : "error",
        streamingMessageId: null,
        // Id inválido: no reintentar el mismo 404 en bucle. Con parcial
        // conservado, Regenerar crea una variante nueva.
        failedRequest:
          hasPartial || missingModel || !err?.retryable
            ? null
            : {
                chatId,
                assistantMessageId: assistantId,
                payloadMessages,
                requestedModel: opts.model,
                capabilities: opts.capabilities,
              },
        rateLimitNotice:
          isRateLimit && hasPartial
            ? {
                message:
                  "Se alcanzó el límite de peticiones a mitad de la respuesta. Se conserva lo recibido hasta ahora.",
                retryAfterMs: err?.retryAfterMs,
              }
            : null,
      });
      return;
    }

    commitBuffer({ status: "complete" });
    set({ generation: "idle", streamingMessageId: null, rateLimitNotice: null });
  }

  return {
    chats: [],
    activeChatId: null,
    generation: "idle",
    streaming: null,
    streamingMessageId: null,
    failedRequest: null,
    rateLimitNotice: null,
    sidebarOpen: true,
    searchQuery: "",
    hydrated: false,

    hydrate: (defaultModel) => {
      const chats = chatRepository.list();
      set({
        chats,
        activeChatId: chats[0]?.id ?? null,
        hydrated: true,
        sidebarOpen: typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
      });
      if (chats.length === 0) {
        get().newChat(defaultModel);
      }
    },

    newChat: (model, projectId) => {
      aborter?.abort();
      stopFlushLoop();
      buffer = null;
      const defaults = useSettingsStore.getState().defaultCapabilities ?? DEFAULT_CAPABILITIES;
      const chat = chatRepository.create(
        model,
        cloneCapabilities(defaults),
        projectId === undefined ? undefined : projectId ?? undefined,
      );
      set({
        chats: chatRepository.list(),
        activeChatId: chat.id,
        generation: "idle",
        streaming: null,
        streamingMessageId: null,
        failedRequest: null,
        rateLimitNotice: null,
        sidebarOpen: typeof window !== "undefined" ? window.innerWidth >= 1024 : get().sidebarOpen,
      });
      return chat.id;
    },

    selectChat: (id) => {
      if (get().generation === "streaming" || get().generation === "submitting") return;
      set({ activeChatId: id });
    },

    renameChat: (id, title) => {
      const chat = chatRepository.get(id);
      if (!chat) return;
      chatRepository.update({ ...chat, title: title.trim() || chat.title });
      set({ chats: chatRepository.list() });
    },

    setChatProject: (chatId, projectId) => {
      const chat = chatRepository.get(chatId);
      if (!chat) return;
      const next: Chat = projectId ? { ...chat, projectId } : { ...chat };
      if (!projectId) delete next.projectId;
      chatRepository.update(touchChat(next));
      set({ chats: chatRepository.list() });
    },

    deleteChat: (id, fallbackModel) => {
      if (get().streamingMessageId && chatRepository.get(id)?.messages.some((m) => m.id === get().streamingMessageId)) {
        get().stop();
      }
      chatRepository.remove(id);
      const chats = chatRepository.list();
      let active = get().activeChatId;
      if (active === id) active = chats[0]?.id ?? null;
      set({ chats, activeChatId: active });
      if (!active) get().newChat(fallbackModel);
    },

    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setSearchQuery: (q) => set({ searchQuery: q }),

    send: async (text, opts) => {
      const clean = text.trim();
      if (!clean || get().generation === "streaming" || get().generation === "submitting") return;
      opts = await resolveSendOpts(opts);
      if (get().generation === "streaming" || get().generation === "submitting") return;
      if (!opts.model.trim()) {
        useModelStore.getState().setPickerOpen(true);
        return;
      }
      let chatId = get().activeChatId;
      if (!chatId || !chatRepository.get(chatId)) {
        chatId = get().newChat(opts.model);
      }
      // Modelo del chat sigue a la selección actual.
      const repoChat = chatRepository.get(chatId);
      if (repoChat && repoChat.model !== opts.model) {
        chatRepository.update({ ...repoChat, model: opts.model });
      }
      const base = chatRepository.get(chatId);
      if (!base) return;
      const repoCaps = cloneCapabilities(base.capabilities ?? DEFAULT_CAPABILITIES);
      set({ generation: "submitting" });

      const baseSystem = opts.systemPrompt.trim();
      const attachmentContext = buildAttachmentContext(opts.attachments ?? []);

      let projectContext = "";
      const chat = chatRepository.get(chatId);
      if (chat?.projectId) {
        try {
          projectContext = await buildProjectContext(chat.projectId, clean, {
            apiKey: opts.apiKey,
            siteTitle: opts.siteTitle,
            siteReferer: opts.siteReferer,
          });
        } catch {
          projectContext = "";
        }
      }

      const finalSystem = [baseSystem, projectContext, attachmentContext].filter(Boolean).join("\n\n");

      const systemMsg: Message[] = finalSystem
        ? [
            {
              id: newId(),
              role: "system",
              content: finalSystem,
              status: "complete",
              createdAt: Date.now(),
            },
          ]
        : [];

      appendUserMessage(chatId, clean, opts.attachments);
      const snapshot = configToSnapshot(opts.capabilities ?? repoCaps);
      const assistant = appendAssistantPlaceholder(chatId, opts.model, snapshot);
      const payload = toPayload([...systemMsg, ...chatRepository.get(chatId)!.messages]);
      await runGeneration(chatId, assistant.id, payload, { ...opts, capabilities: opts.capabilities ?? repoCaps });
    },

    stop: () => {
      if (get().generation !== "streaming" && get().generation !== "submitting") return;
      set({ generation: "stopping" });
      aborter?.abort();
    },

    editAndResend: async (messageId, text, opts) => {
      const chatId = get().activeChatId;
      if (!chatId || get().generation === "streaming" || get().generation === "submitting") return;
      const chat = chatRepository.get(chatId);
      if (!chat) return;
      const idx = chat.messages.findIndex((m) => m.id === messageId && m.role === "user");
      if (idx === -1) return;
      const truncated = chat.messages.slice(0, idx);
      chatRepository.update(touchChat({ ...chat, messages: truncated }));
      set({ chats: chatRepository.list() });
      await get().send(text, opts);
    },

    regenerate: async (opts) => {
      const chatId = get().activeChatId;
      if (!chatId || get().generation === "streaming" || get().generation === "submitting") return;
      opts = await resolveSendOpts(opts);
      if (get().generation === "streaming" || get().generation === "submitting") return;
      const chat = chatRepository.get(chatId);
      if (!chat) return;
      const msgs = chat.messages.filter((m) => m.status !== "error");
      const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
      const kept = lastAssistant ? msgs.filter((m) => m.id !== lastAssistant.id) : msgs;
      if (!kept.some((m) => m.role === "user")) return;
      const caps = snapshotToConfig(lastAssistant?.capabilities, chat.capabilities ?? DEFAULT_CAPABILITIES);
      chatRepository.update(touchChat({ ...chat, messages: kept }));
      set({ generation: "submitting" });
      const assistant = appendAssistantPlaceholder(chatId, opts.model, configToSnapshot(caps));
      const systemMsg = opts.systemPrompt.trim()
        ? [{ role: "system" as const, content: opts.systemPrompt.trim() }]
        : [];
      await runGeneration(chatId, assistant.id, [...systemMsg, ...toPayload(kept)], {
        ...opts,
        capabilities: caps,
      });
    },

    retryFailed: async (opts) => {
      const failed = get().failedRequest;
      if (!failed || get().generation === "streaming" || get().generation === "submitting") return;
      const resolved = await resolveSendOpts(
        { ...opts, model: failed.requestedModel, capabilities: failed.capabilities ?? opts.capabilities },
        true,
      );
      if (get().generation === "streaming" || get().generation === "submitting") return;
      if (!isKnownModel(failed.requestedModel, useModelStore.getState().models)) {
        useModelStore.getState().setPickerOpen(true);
      }
      set({ generation: "submitting" });
      await runGeneration(failed.chatId, failed.assistantMessageId, failed.payloadMessages, resolved);
    },

    setChatCapabilities: (chatId, config) => {
      const chat = chatRepository.get(chatId);
      if (!chat) return;
      chatRepository.update({ ...chat, capabilities: cloneCapabilities(config) });
      set({ chats: chatRepository.list() });
    },

    patchChatCapabilities: (chatId, patch) => {
      const chat = chatRepository.get(chatId);
      if (!chat) return;
      const current = chat.capabilities ?? DEFAULT_CAPABILITIES;
      const next = cloneCapabilities({
        reasoning: { ...current.reasoning, ...patch.reasoning },
        webSearch: { ...current.webSearch, ...patch.webSearch },
        imageGen: { ...current.imageGen, ...(patch as Partial<CapabilityConfig>).imageGen },
        videoGen: { ...current.videoGen, ...(patch as Partial<CapabilityConfig>).videoGen },
        audioGen: { ...current.audioGen, ...(patch as Partial<CapabilityConfig>).audioGen },
      });
      chatRepository.update({ ...chat, capabilities: next });
      set({ chats: chatRepository.list() });
    },

    activeChat: () => selectActiveChat(get()),
  };
});

function dataUrlFromBase64(format: string, b64: string): string {
  return `data:audio/${format};base64,${b64}`;
}

function appendBase64(prefix: string, b64: string): string {
  if (prefix.includes(";base64,")) {
    const i = prefix.indexOf(";base64,");
    return prefix.slice(0, i + 8) + prefix.slice(i + 8) + b64;
  }
  return prefix + b64;
}
