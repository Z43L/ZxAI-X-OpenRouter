"use client";

import { Plus, Music, Trash2 } from "lucide-react";
import { useStudioStore } from "@/store/studio-store";
import { cn } from "@/lib/utils/cn";
import { timeAgo } from "@/lib/utils/format";

export function StudioSidebar() {
  const sessions = useStudioStore((s) => s.sessions);
  const activeId = useStudioStore((s) => s.activeSessionId);
  const newSession = useStudioStore((s) => s.newSession);
  const switchSession = useStudioStore((s) => s.switchSession);
  const removeSession = useStudioStore((s) => s.removeSession);

  const handleNew = async () => {
    await newSession(`Sesión ${sessions.length + 1}`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <button
          type="button"
          onClick={() => void handleNew()}
          className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" /> Nueva sesión
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-zinc-400">
            Crea una sesión para empezar.
          </p>
        )}
        {sessions.map((session) => {
          const active = session.id === activeId;
          return (
            <div
              key={session.id}
              className={cn(
                "group relative mb-0.5 flex items-center rounded-lg pr-1 text-sm transition-colors",
                active ? "bg-zinc-200/70 dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60",
              )}
            >
              <button
                type="button"
                onClick={() => void switchSession(session.id)}
                className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
              >
                <Music className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-zinc-800 dark:text-zinc-200">
                    {session.name}
                  </span>
                  <span className="block text-[11px] text-zinc-400">
                    {session.clips.length} clips · {timeAgo(session.updatedAt)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void removeSession(session.id)}
                aria-label={`Eliminar ${session.name}`}
                className="ml-auto rounded p-1 text-zinc-400 opacity-0 hover:bg-zinc-300/60 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-zinc-700"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
