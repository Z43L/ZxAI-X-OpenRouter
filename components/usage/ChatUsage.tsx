"use client";

import { memo, useMemo } from "react";
import { formatCost, formatTokens } from "@/lib/utils/format";
import type { Chat } from "@/types/chat";

export const ChatUsage = memo(function ChatUsage({ chat }: { chat: Chat }) {
  const total = useMemo(() => {
    let prompt = 0;
    let completion = 0;
    let cost = 0;
    let hasCost = false;
    for (const m of chat.messages) {
      if (!m.usage) continue;
      prompt += m.usage.promptTokens;
      completion += m.usage.completionTokens;
      if (m.usage.cost !== undefined) {
        cost += m.usage.cost;
        hasCost = true;
      }
    }
    return { prompt, completion, cost, hasCost };
  }, [chat.messages]);

  if (total.prompt === 0 && total.completion === 0) return null;
  return (
    <div
      className="hidden items-center gap-2 text-xs text-zinc-500 md:flex dark:text-zinc-400"
      title="Uso acumulado de esta conversación"
    >
      <span>
        {formatTokens(total.prompt)} → {formatTokens(total.completion)}
      </span>
      {total.hasCost && <span className="font-medium">{formatCost(total.cost)}</span>}
    </div>
  );
});
