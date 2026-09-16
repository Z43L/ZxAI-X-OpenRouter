"use client";

import { Check, Copy, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { Message } from "@/types/chat";
import { cn } from "@/lib/utils/cn";

export function MessageActions({
  message,
  isLastAssistant,
  canRegenerate,
  onCopy,
  onEdit,
  onRegenerate,
}: {
  message: Message;
  isLastAssistant: boolean;
  canRegenerate: boolean;
  onCopy: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (message.status === "streaming" || message.status === "pending") return null;

  const handleCopy = async () => {
    onCopy();
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* se ignora */
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 px-4 pb-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 sm:px-6",
        message.role === "user" && "justify-end pr-4 sm:pr-6",
      )}
    >
      <button
        type="button"
        onClick={handleCopy}
        title="Copiar"
        className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      {message.role === "user" && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Editar y reenviar"
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      {message.role === "assistant" && isLastAssistant && canRegenerate && onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          title="Regenerar respuesta"
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
