"use client";

import { useEffect, useState } from "react";
import { GitBranch } from "lucide-react";
import { getProvider } from "@/lib/workspace/registry";
import { GitHubWorkspaceProvider } from "@/lib/workspace/github/github-provider";
import { useWorkspaceStore } from "@/store/workspace-store";
import { GitHubClient } from "@/lib/workspace/github/github-client";
import { useGitHubStore } from "@/store/github-store";

export function BranchPicker() {
  const meta = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId));
  const token = useGitHubStore((s) => s.token);
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const github = meta?.github;

  useEffect(() => {
    if (!open || !token || !github) return;
    const client = new GitHubClient(token);
    void client.listBranches(github.owner, github.repo).then((list) => setBranches(list.map((b) => b.name)));
  }, [open, token, github]);

  if (!meta || !github) return null;

  const switchTo = async (name: string) => {
    const provider = getProvider(meta.id);
    if (!(provider instanceof GitHubWorkspaceProvider)) return;
    try {
      await provider.switchBranch(name);
      useWorkspaceStore.setState((s) => ({
        workspaces: s.workspaces.map((w) =>
          w.id === meta.id && w.github ? { ...w, github: { ...w.github, branch: name, baseSha: provider.baseSha } } : w,
        ),
      }));
      setOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const create = async () => {
    const name = window.prompt("Nombre de la nueva rama");
    if (!name) return;
    const provider = getProvider(meta.id);
    if (!(provider instanceof GitHubWorkspaceProvider)) return;
    try {
      await provider.createBranch(name);
      useWorkspaceStore.setState((s) => ({
        workspaces: s.workspaces.map((w) =>
          w.id === meta.id && w.github ? { ...w, github: { ...w.github, branch: name, baseSha: provider.baseSha } } : w,
        ),
      }));
      setOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <GitBranch className="h-3.5 w-3.5" />
        {github.branch}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 w-64 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar ramas…"
            className="mb-2 w-full rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
          />
          <ul className="max-h-56 overflow-auto text-sm">
            {branches
              .filter((b) => b.toLowerCase().includes(q.toLowerCase()))
              .map((b) => (
                <li key={b}>
                  <button type="button" onClick={() => void switchTo(b)} className="w-full rounded px-2 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    {b === github.branch ? "✓ " : "  "}
                    {b}
                  </button>
                </li>
              ))}
          </ul>
          <button type="button" onClick={() => void create()} className="mt-1 w-full rounded px-2 py-1 text-left text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            + Create branch
          </button>
        </div>
      )}
    </div>
  );
}
