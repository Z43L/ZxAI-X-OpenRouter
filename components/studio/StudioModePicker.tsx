"use client";

import { Bot, User } from "lucide-react";
import { useStudioStore } from "@/store/studio-store";
import { cn } from "@/lib/utils/cn";

export function StudioModePicker() {
  const sessions = useStudioStore((s) => s.sessions);
  const activeId = useStudioStore((s) => s.activeSessionId);
  const setMode = useStudioStore((s) => s.setMode);
  const session = activeId ? sessions.find((s) => s.id === activeId) : null;
  const current = session?.mode ?? "manual";
  return (
    <div className="inline-flex items-center rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => void setMode("manual")}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
          current === "manual"
            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
        )}
      >
        <User className="h-3 w-3" /> Manual
      </button>
      <button
        type="button"
        onClick={() => void setMode("agent")}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
          current === "agent"
            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
        )}
      >
        <Bot className="h-3 w-3" /> Agente
      </button>
    </div>
  );
}
