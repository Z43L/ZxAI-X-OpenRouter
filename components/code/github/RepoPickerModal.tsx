"use client";

import { useMemo, useState } from "react";
import { useGitHubStore } from "@/store/github-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { X } from "lucide-react";

export function RepoPickerModal() {
  const open = useGitHubStore((s) => s.pickerOpen);
  const setOpen = useGitHubStore((s) => s.setPickerOpen);
  const repos = useGitHubStore((s) => s.repos);
  const loading = useGitHubStore((s) => s.loadingRepos);
  const refresh = useGitHubStore((s) => s.refreshRepos);
  const user = useGitHubStore((s) => s.user);
  const openRepo = useWorkspaceStore((s) => s.openGitHubRepo);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "owned" | "public" | "private">("all");

  const list = useMemo(() => {
    return repos.filter((r) => {
      if (q && !r.full_name.toLowerCase().includes(q.toLowerCase())) return false;
      if (filter === "owned" && user && r.owner.login !== user.login) return false;
      if (filter === "public" && r.private) return false;
      if (filter === "private" && !r.private) return false;
      return true;
    });
  }, [repos, q, filter, user]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-base font-semibold">Abrir repositorio</h2>
          <button type="button" onClick={() => setOpen(false)}>
            <X className="h-4 w-4 text-zinc-400" />
          </button>
        </div>
        <div className="p-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar repositorios…"
            className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <div className="mt-2 flex gap-1 text-[11px]">
            {(["all", "owned", "public", "private"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-2 py-0.5 capitalize ${filter === f ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}
              >
                {f}
              </button>
            ))}
            <button type="button" onClick={() => void refresh()} className="ml-auto text-zinc-500">
              Actualizar
            </button>
          </div>
        </div>
        <ul className="flex-1 overflow-auto px-2 pb-3">
          {loading && <li className="px-2 py-4 text-sm text-zinc-400">Cargando…</li>}
          {list.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => void openRepo(r.owner.login, r.name).catch((e) => alert(e instanceof Error ? e.message : String(e)))}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span>
                  <span className="block text-sm font-medium">{r.full_name}</span>
                  <span className="text-[11px] text-zinc-400">
                    {r.language ?? "—"} · {r.private ? "Private" : "Public"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
