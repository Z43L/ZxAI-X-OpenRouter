"use client";

import { memo, useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { RotateCcw } from "lucide-react";
import { selectActiveChat, useChatStore } from "@/store/chat-store";
import type { SendOpts } from "@/store/chat-store";
import { MessageBubble } from "./MessageBubble";
import { MessageActions } from "./MessageActions";
import { EmptyChat } from "./EmptyChat";
import { ScrollToBottom } from "./ScrollToBottom";

/**
 * Autoscroll estilo ChatGPT: sigue la generación solo si el usuario
 * está a <150px del fondo; si sube a leer, se desactiva y aparece ↓.
 */
const NEAR_BOTTOM_PX = 150;

/** Se suscribe al texto en vivo sin re-renderizar la lista de mensajes. */
const StickToStream = memo(function StickToStream({
  stickRef,
  onStick,
}: {
  stickRef: RefObject<boolean>;
  onStick: () => void;
}) {
  const text = useChatStore((s) => s.streaming?.text);
  useEffect(() => {
    if (stickRef.current) onStick();
  }, [text, onStick, stickRef]);
  return null;
});

export const MessageList = memo(function MessageList({
  sendOpts,
  onSuggestion,
}: {
  sendOpts: SendOpts;
  onSuggestion: (text: string) => void;
}) {
  const chat = useChatStore(selectActiveChat);
  const generation = useChatStore((s) => s.generation);
  const failedRequest = useChatStore((s) => s.failedRequest);
  const rateLimitNotice = useChatStore((s) => s.rateLimitNotice);
  const editAndResend = useChatStore((s) => s.editAndResend);
  const regenerate = useChatStore((s) => s.regenerate);
  const retryFailed = useChatStore((s) => s.retryFailed);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const messages = chat?.messages ?? [];
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const busy = generation === "streaming" || generation === "submitting" || generation === "stopping";
  const showFailed = failedRequest && chat && failedRequest.chatId === chat.id;

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    stickRef.current = nearBottom;
    setShowJump(!nearBottom && messages.length > 2);
  }, [messages.length]);

  useEffect(() => {
    if (stickRef.current) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    stickRef.current = true;
    setShowJump(false);
    requestAnimationFrame(() => scrollToBottom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id]);

  const submitEdit = useCallback(
    (messageId: string) => {
      if (!editText.trim()) return;
      setEditingId(null);
      void editAndResend(messageId, editText, sendOpts);
    },
    [editText, editAndResend, sendOpts],
  );

  if (!chat || messages.length === 0) {
    return <EmptyChat onSuggestion={onSuggestion} />;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <StickToStream stickRef={stickRef} onStick={scrollToBottom} />
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl py-4">
          {messages
            .filter((m) => m.role !== "system")
            .map((m) => (
              <div key={m.id} className="group">
                {editingId === m.id && m.role === "user" ? (
                  <div className="flex justify-end px-4 py-2 sm:px-6">
                    <div className="w-full max-w-[85%] sm:max-w-[75%]">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-[15px] outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submitEdit(m.id);
                          }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <div className="mt-1.5 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => submitEdit(m.id)}
                          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                        >
                          Reenviar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <MessageBubble message={m} />
                    <MessageActions
                      message={m}
                      isLastAssistant={m.id === lastAssistantId}
                      canRegenerate={!busy}
                      onCopy={() => undefined}
                      onEdit={
                        m.role === "user"
                          ? () => {
                              setEditingId(m.id);
                              setEditText(m.content);
                            }
                          : undefined
                      }
                      onRegenerate={m.role === "assistant" ? () => regenerate(sendOpts) : undefined}
                    />
                  </>
                )}
              </div>
            ))}

          {rateLimitNotice && (
            <div className="px-4 py-2 sm:px-6">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {rateLimitNotice.message}
              </div>
            </div>
          )}

          {showFailed && (
            <div className="px-4 py-2 sm:px-6">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <span className="flex-1">La generación falló. Puedes reintentar la misma petición.</span>
                <button
                  type="button"
                  onClick={() => retryFailed(sendOpts)}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reintentar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <ScrollToBottom visible={showJump} onClick={() => scrollToBottom(true)} />
    </div>
  );
});
