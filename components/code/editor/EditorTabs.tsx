"use client";

import { Pin, X } from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import type { EditorGroup } from "@/types/code";
import { basename } from "@/lib/workspace/path";
import { cn } from "@/lib/utils/cn";

export function EditorTabs({ group }: { group: EditorGroup }) {
  const closeTab = useEditorStore((s) => s.closeTab);
  const setActive = useEditorStore((s) => s.setActiveTab);
  const pinTab = useEditorStore((s) => s.pinTab);
  const buffers = useEditorStore((s) => {
    const w = s.activeWorkspaceId ? s.byWorkspace[s.activeWorkspaceId] : undefined;
    return w?.buffers ?? {};
  });

  return (
    <div className="flex shrink-0 overflow-x-auto border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {group.tabs.map((tab) => {
        const dirty = buffers[tab.path]?.dirty;
        const active = group.activePath === tab.path;
        return (
          <div
            key={tab.path}
            className={cn(
              "group flex max-w-[220px] shrink-0 items-center gap-1 border-r border-zinc-200 px-2 py-1.5 text-[12px] dark:border-zinc-800",
              active
                ? "bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200",
              tab.preview && "italic",
            )}
          >
            <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => setActive(group.id, tab.path)} onDoubleClick={() => pinTab(group.id, tab.path)}>
              {basename(tab.path)}
            </button>
            {dirty ? <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" title="Sin guardar" /> : null}
            {tab.pinned && <Pin className="h-3 w-3 text-zinc-400" />}
            <button
              type="button"
              className="rounded p-0.5 opacity-70 hover:bg-zinc-200 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-zinc-700"
              onClick={() => closeTab(group.id, tab.path)}
              aria-label="Cerrar"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
