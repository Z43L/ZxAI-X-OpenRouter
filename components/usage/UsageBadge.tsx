"use client";

import { memo } from "react";
import { formatCost, formatDuration, formatTokens } from "@/lib/utils/format";
import type { Message } from "@/types/chat";

export const UsageBadge = memo(function UsageBadge({ message }: { message: Message }) {
  const u = message.usage;
  if (message.role !== "assistant" || (!u && !message.actualModel)) return null;
  const parts: string[] = [];
  if (u) parts.push(`${formatTokens(u.promptTokens)} → ${formatTokens(u.completionTokens)}`);
  if (u?.reasoningTokens) parts.push(`◈ ${formatTokens(u.reasoningTokens)} razonamiento`);
  const sources = message.citations?.length ?? 0;
  if (sources > 0) parts.push(`🌐 ${sources} ${sources === 1 ? "fuente" : "fuentes"}`);
  else if (u?.webSearchRequests) parts.push(`🌐 ${u.webSearchRequests} búsquedas`);
  if (u?.cost !== undefined) parts.push(formatCost(u.cost));
  if (message.elapsedMs) parts.push(formatDuration(message.elapsedMs));
  if (message.actualModel && message.actualModel !== message.requestedModel) {
    const short = message.actualModel.split("/").pop();
    parts.push(`vía ${short}`);
  }
  if (parts.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-500 dark:text-zinc-400">
      {parts.map((p, i) => (
        <span key={i} className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
          {p}
        </span>
      ))}
    </div>
  );
});
