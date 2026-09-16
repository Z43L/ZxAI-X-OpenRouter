"use client";

import { useEffect, useState } from "react";
import { getProvider } from "@/lib/workspace/registry";
import { GitHubWorkspaceProvider } from "@/lib/workspace/github/github-provider";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useScmStore } from "@/store/scm-store";
import { useEditorStore } from "@/store/editor-store";
import type { WorkspaceDiff } from "@/types/workspace";

export function ScmPanel() {
  const workspaceId = useWorkspaceStore((s) => s.activeId);
  const type = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId)?.type);
  const message = useScmStore((s) => s.message);
  const setMessage = useScmStore((s) => s.setMessage);
  const commit = useScmStore((s) => s.commit);
  const committing = useScmStore((s) => s.committing);
  const error = useScmStore((s) => s.error);
  const openFile = useEditorStore((s) => s.openFile);
  const [diff, setDiff] = useState<WorkspaceDiff | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const p = getProvider(workspaceId);
      if (p instanceof GitHubWorkspaceProvider) {
        const d = await p.getDiff();
        if (alive) setDiff(d);
      } else {
        const editor = useEditorStore.getState().current();
        const files = Object.values(editor?.buffers ?? {})
          .filter((b) => b.dirty)
          .map((b) => ({ path: b.path, status: "modified" as const, original: b.savedContent, current: b.content }));
        if (alive) setDiff({ files, insertions: 0, deletions: 0 });
      }
    };
    void load();
    const t = window.setInterval(() => void load(), 1500);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [workspaceId]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 px-2 py-1.5 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:border-zinc-800">
        Source Control
      </div>
      <div className="flex-1 overflow-auto p-2 text-sm">
        <p className="mb-2 text-xs text-zinc-500">Changes {diff?.files.length ?? 0}</p>
        {(diff?.files ?? []).map((f) => (
          <button
            key={f.path}
            type="button"
            onClick={() => void openFile(f.path)}
            className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <span className="w-4 font-mono text-xs text-amber-600">{f.status[0]!.toUpperCase()}</span>
            <span className="truncate text-xs">{f.path}</span>
          </button>
        ))}
        {type === "github" ? (
          <div className="mt-4">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Mensaje de commit"
              className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={() => void commit()}
              disabled={committing || !diff?.files.length}
              className="mt-2 w-full rounded-lg bg-zinc-900 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {committing ? "Creando commit…" : "Commit"}
            </button>
            <p className="mt-1 text-[11px] text-zinc-400">
              Un solo commit con todos los archivos del buffer. No se publica en cada pulsación.
            </p>
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>
        ) : (
          <p className="mt-4 text-xs text-zinc-400">
            En local, Auto Save escribe en disco. No hay commit: usa Git en tu máquina o un workspace de GitHub.
          </p>
        )}
      </div>
    </div>
  );
}
