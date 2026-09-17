"use client";

import { useEffect, useRef } from "react";
import { useStudioStore } from "@/store/studio-store";

export function StudioChat() {
  const sessions = useStudioStore((s) => s.sessions);
  const activeId = useStudioStore((s) => s.activeSessionId);
  const ref = useRef<HTMLDivElement>(null);
  const session = activeId ? sessions.find((s) => s.id === activeId) : null;
  const messages = session?.messages ?? [];

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages.length]);

  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
      <div className="mx-auto max-w-3xl space-y-2">
        {messages.length === 0 && (
          <p className="py-12 text-center text-sm text-zinc-400">
            Empieza describiendo el estilo musical que quieres en el compositor de abajo.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : m.role === "system"
                    ? "border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                    : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
