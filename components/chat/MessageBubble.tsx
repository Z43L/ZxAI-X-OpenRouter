"use client";

import { memo } from "react";
import { cn } from "@/lib/utils/cn";
import { selectMessageContent, useChatStore } from "@/store/chat-store";
import { useModelStore } from "@/store/model-store";
import type { Message } from "@/types/chat";
import { UsageBadge } from "../usage/UsageBadge";
import { SearchStatus } from "./SearchStatus";
import { CitationList } from "../citations/CitationList";
import { InlineCitation } from "../citations/InlineCitation";
import { reasoningChipLabel } from "@/lib/capabilities";
import { MarkdownRenderer } from "../markdown/MarkdownRenderer";

export const MessageBubble = memo(function MessageBubble({ message }: { message: Message }) {
  const liveContent = useChatStore((s) => selectMessageContent(s, message.id));
  const streamingMeta = useChatStore((s) =>
    s.streaming?.messageId === message.id ? s.streaming : null,
  );
  const setPickerOpen = useModelStore((s) => s.setPickerOpen);
  const content = liveContent ?? message.content;
  const isUser = message.role === "user";
  const isStreaming =
    liveContent !== null || message.status === "streaming" || message.status === "pending";
  const citations = message.citations ?? [];

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2 sm:px-6">
        <div className="max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-zinc-900 sm:max-w-[75%] dark:bg-zinc-800 dark:text-zinc-100">
          {content}
        </div>
      </div>
    );
  }

  if (message.status === "error") {
    const detail = message.error?.detail?.trim();
    const showDetail = detail && detail !== message.error?.message;
    const pickModel = message.error?.retryable === false;
    return (
      <div className="px-4 py-2 sm:px-6">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-semibold">No se pudo completar la respuesta</p>
          <p className="mt-1">{message.error?.message ?? "Error desconocido."}</p>
          {showDetail && <p className="mt-1 text-xs opacity-80">{detail}</p>}
          {pickModel && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-2 rounded-lg bg-red-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 dark:bg-red-200 dark:text-red-950 dark:hover:bg-red-100"
            >
              Elegir modelo
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isStreaming && !content) {
    return (
      <div className="px-4 py-3 sm:px-6">
        {streamingMeta?.searchPhase && streamingMeta.searchPhase !== "idle" ? (
          <SearchStatus phase={streamingMeta.searchPhase} sourceCount={streamingMeta.sourceCount} />
        ) : (
          <div className="flex items-center gap-1.5 py-2" aria-label="Generando respuesta">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative px-4 py-2 sm:px-6",
        message.status === "stopped" && "opacity-90",
      )}
    >
      <div className="relative text-[15px] leading-relaxed break-words">
        <MarkdownRenderer
          content={content}
          isStreaming={isStreaming}
          className="text-[15px] leading-relaxed"
        />
        {isStreaming && (
          <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-zinc-400 align-middle dark:bg-zinc-500" />
        )}
      </div>
      {!isStreaming && citations.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-0.5">
          {citations.map((c, i) => (
            <InlineCitation key={`${c.url}-${i}`} citation={c} index={i} />
          ))}
        </p>
      )}
      {!isStreaming && <CitationList citations={citations} />}
      {message.searchWarning && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          ⚠ {message.searchWarning}
        </p>
      )}
      {message.status === "stopped" && (
        <p className="mt-1 text-xs text-amber-600 italic dark:text-amber-400">
          Detenida por el usuario — respuesta parcial conservada.
        </p>
      )}
      {!isStreaming && <CapabilityMeta message={message} />}
      <UsageBadge message={message} />
    </div>
  );
});

function CapabilityMeta({ message }: { message: Message }) {
  const caps = message.capabilities;
  if (!caps && !message.requestedModel) return null;
  const parts: string[] = [];
  if (caps?.webSearch) parts.push("🌐 Web");
  const reason = caps?.reasoning ? reasoningChipLabel(caps.reasoning) : null;
  if (reason) parts.push(`◈ ${reason}`);
  const model = (message.actualModel || message.requestedModel)?.split("/").pop();
  if (model) parts.push(model);
  if (parts.length === 0) return null;
  return <p className="mt-1.5 text-[11px] text-zinc-400">{parts.join(" · ")}</p>;
}
