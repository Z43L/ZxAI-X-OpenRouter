"use client";

import { useEffect, useMemo, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useEditorStore } from "@/store/editor-store";
import { useCodingAgentStore } from "@/store/coding-agent-store";
import { useSettingsStore } from "@/store/settings-store";
import { useGitHubStore } from "@/store/github-store";
import { getProvider } from "@/lib/workspace/registry";
import { GitHubWorkspaceProvider } from "@/lib/workspace/github/github-provider";

interface Command {
  id: string;
  label: string;
  run: () => void | Promise<void>;
}

export function CommandPalette() {
  const open = useWorkspaceStore((s) => s.commandOpen);
  const setOpen = useWorkspaceStore((s) => s.setCommandOpen);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const commands = useMemo<Command[]>(() => {
    const ws = useWorkspaceStore.getState();
    const ed = useEditorStore.getState();
    const ag = useCodingAgentStore.getState();
    return [
      {
        id: "open-folder",
        label: "File: Open Folder",
        run: () =>
          useWorkspaceStore
            .getState()
            .openLocalFolder()
            .catch((e) => alert(e instanceof Error ? e.message : String(e))),
      },
      {
        id: "close-folder",
        label: "File: Close Folder",
        run: () => {
          const id = useWorkspaceStore.getState().activeId;
          if (id) void useWorkspaceStore.getState().closeWorkspace(id);
        },
      },
      {
        id: "open-github",
        label: "GitHub: Open Repository",
        run: () => {
          const gh = useGitHubStore.getState();
          if (gh.token) gh.setPickerOpen(true);
          else gh.setConnectOpen(true);
        },
      },
      { id: "new-file", label: "File: New File", run: () => ws.setActivity("explorer") },
      { id: "save", label: "File: Save", run: () => ed.save(ed.current()?.groups.find((g) => g.id === ed.current()?.activeGroupId)?.activePath ?? "") },
      { id: "save-all", label: "File: Save All", run: () => ed.saveAll() },
      { id: "split-v", label: "View: Split Vertical", run: () => ed.toggleSplit("vertical") },
      { id: "split-h", label: "View: Split Horizontal", run: () => ed.toggleSplit("horizontal") },
      { id: "split-off", label: "View: Single Editor", run: () => ed.toggleSplit("single") },
      { id: "ai", label: "View: Toggle AI", run: () => ws.setRightOpen(!ws.rightOpen) },
      { id: "search", label: "View: Search", run: () => ws.setActivity("search") },
      { id: "scm", label: "View: Source Control", run: () => ws.setActivity("scm") },
      { id: "ask", label: "AI: Explain Selection", run: () => { ag.setMode("ask"); void ag.send("Explica la selección actual."); } },
      { id: "fix", label: "AI: Fix Selection", run: () => { ag.setMode("edit"); void ag.send("Corrige la selección actual."); } },
      { id: "refactor", label: "AI: Refactor Selection", run: () => { ag.setMode("edit"); void ag.send("Refactoriza la selección actual."); } },
      { id: "tests", label: "AI: Generate Tests", run: () => { ag.setMode("edit"); void ag.send("Genera tests para el archivo o selección actual."); } },
      { id: "settings", label: "Preferences: Open Settings", run: () => useSettingsStore.getState().setSettingsOpen(true) },
      { id: "gh-branch", label: "GitHub: Create Branch", run: async () => {
        const p = getProvider(ws.activeId);
        if (p instanceof GitHubWorkspaceProvider) {
          const name = window.prompt("Nombre de rama");
          if (name) await p.createBranch(name);
        }
      } },
    ];
  }, []);

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(filtered.length - 1, i + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[idx];
        if (cmd) {
          void cmd.run();
          setOpen(false);
          setQ("");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, idx, setOpen]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          placeholder="Escribe un comando…"
          className="w-full border-b border-zinc-200 bg-transparent px-4 py-3 text-sm outline-none dark:border-zinc-800"
        />
        <ul className="max-h-80 overflow-auto py-1">
          {filtered.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  void c.run();
                  setOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm ${i === idx ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
