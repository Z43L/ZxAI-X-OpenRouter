import type { Citation } from "@/types/capabilities";
import { citationsFromAnnotations } from "@/lib/citations/parse";

export interface SSEToolCall {
  type?: string;
  id?: string;
  index?: number;
  function?: { name?: string; arguments?: string };
}

export interface SSEImageData {
  url?: string;
  image_url?: { url?: string };
  b64_json?: string;
}

export interface SSEAudioData {
  data?: string;
  transcript?: string;
  expires_at?: number;
  id?: string;
}

export interface SSEChunk {
  id?: string;
  model?: string;
  content?: string;
  reasoning?: string;
  finishReason?: string | null;
  nativeFinishReason?: string | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
    completion_tokens_details?: { reasoning_tokens?: number; audio_tokens?: number };
    prompt_tokens_details?: { cached_tokens?: number; audio_tokens?: number };
    server_tool_use?: { web_search_requests?: number };
  };
  annotations?: Citation[];
  toolCalls?: SSEToolCall[];
  webSearch?: boolean;
  searchError?: boolean;
  error?: { code?: number | string; message?: string };
  images?: SSEImageData[];
  audio?: SSEAudioData;
  video?: { url?: string };
}

interface RawDelta {
  content?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
  role?: string;
  tool_calls?: SSEToolCall[];
  annotations?: unknown[];
  images?: SSEImageData[];
  audio?: SSEAudioData;
  video?: { url?: string };
}

interface RawMessage {
  content?: string | null;
  annotations?: unknown[];
  images?: SSEImageData[];
  audio?: SSEAudioData;
  video?: { url?: string };
}

interface RawChoice {
  delta?: RawDelta;
  message?: RawMessage;
  finish_reason?: string | null;
  native_finish_reason?: string | null;
  error?: { code?: number | string; message?: string };
}

interface RawChunk {
  id?: string;
  model?: string;
  choices?: RawChoice[];
  usage?: SSEChunk["usage"];
  error?: { code?: number | string; message?: string };
  annotations?: unknown[];
}

export function isWebSearchToolCall(tc: SSEToolCall | undefined): boolean {
  if (!tc) return false;
  const type = (tc.type ?? "").toLowerCase();
  const name = (tc.function?.name ?? "").toLowerCase();
  return type.includes("web_search") || name.includes("web_search") || name.includes("websearch");
}

function isSearchErrorMessage(message?: string): boolean {
  if (!message) return false;
  return /web.?search|search (failed|error)|unable to search|plugin.*web/i.test(message);
}

/** Convierte un payload SSE (sin el prefijo "data: ") en chunk normalizado. */
export function parseSSEPayload(data: string): SSEChunk | null {
  if (!data || data === "[DONE]") return null;
  let raw: RawChunk;
  try {
    raw = JSON.parse(data) as RawChunk;
  } catch {
    return null; // fragmento incompleto: se ignora
  }
  if (raw.error) {
    return {
      error: raw.error,
      searchError: isSearchErrorMessage(raw.error.message),
    };
  }
  const choice = raw.choices?.[0];
  if (!choice && !raw.usage && !raw.annotations) return null;
  const delta = choice?.delta;
  const toolCalls = delta?.tool_calls;
  const annotations = citationsFromAnnotations(
    delta?.annotations ?? choice?.message?.annotations ?? raw.annotations,
  );
  const searchError = isSearchErrorMessage(choice?.error?.message);
  return {
    id: raw.id,
    model: raw.model,
    content: delta?.content ?? choice?.message?.content ?? undefined,
    reasoning: delta?.reasoning ?? delta?.reasoning_content ?? undefined,
    finishReason: choice?.finish_reason ?? null,
    nativeFinishReason: choice?.native_finish_reason ?? null,
    usage: raw.usage,
    annotations: annotations.length > 0 ? annotations : undefined,
    toolCalls,
    webSearch: toolCalls?.some(isWebSearchToolCall) ?? false,
    searchError: searchError || undefined,
    error: choice?.error,
    images: delta?.images ?? choice?.message?.images ?? undefined,
    audio: delta?.audio ?? choice?.message?.audio ?? undefined,
    video: delta?.video ?? choice?.message?.video ?? undefined,
  };
}

/**
 * Itera eventos SSE desde un ReadableStream.
 * Los comentarios SSE (líneas que empiezan por ":") se ignoran.
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SSEChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      if (done) break;

      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line || line.startsWith(":")) continue;
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        const chunk = parseSSEPayload(data);
        if (chunk) yield chunk;
      }
    }
    // Drenar resto del buffer al finalizar.
    for (const line of buffer.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      const chunk = parseSSEPayload(data);
      if (chunk) yield chunk;
    }
  } finally {
    reader.releaseLock();
  }
}
