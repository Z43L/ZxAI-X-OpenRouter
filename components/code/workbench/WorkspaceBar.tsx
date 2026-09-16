"use client";

import { FolderGit2, FolderOpen, X } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useGitHubStore } from "@/store/github-store";

function reportOpenError(e: unknown) {
  alert(e instanceof Error ? e.message : String(e));
}

export function WorkspaceBar() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeId);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const closeWorkspace = useWorkspaceStore((s) => s.closeWorkspace);
  const openLocal = useWorkspaceStore((s) => s.openLocalFolder);
  const token = useGitHubStore((s) => s.token);
  const setPickerOpen = useGitHubStore((s) => s.setPickerOpen);
  const setConnectOpen = useGitHubStore((s) => s.setConnectOpen);

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 px-2 py-1 dark:border-zinc-800">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {workspaces.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => selectWorkspace(w.id)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${
              w.id === activeId ? "bg-zinc-200 dark:bg-zinc-800" : "text-zinc-500"
            }`}
          >
            <span className="max-w-[160px] truncate">{w.name}</span>
            <span
              role="button"
              tabIndex={0}
              aria-label={`Cerrar ${w.name}`}
              title="Cerrar carpeta"
              onClick={(e) => {
                e.stopPropagation();
                void closeWorkspace(w.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  void closeWorkspace(w.id);
                }
              }}
              className="rounded p-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-700"
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        title="Abrir carpeta"
        onClick={() => void openLocal().catch(reportOpenError)}
        className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800"
      >
        <FolderOpen className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Abrir repositorio de GitHub"
        onClick={() => (token ? setPickerOpen(true) : setConnectOpen(true))}
        className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800"
      >
        <FolderGit2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
