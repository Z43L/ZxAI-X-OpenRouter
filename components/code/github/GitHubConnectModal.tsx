"use client";

import { useState } from "react";
import { useGitHubStore } from "@/store/github-store";
import { X } from "lucide-react";

export function GitHubConnectModal() {
  const open = useGitHubStore((s) => s.connectOpen);
  const setOpen = useGitHubStore((s) => s.setConnectOpen);
  const connect = useGitHubStore((s) => s.connect);
  const connecting = useGitHubStore((s) => s.connecting);
  const error = useGitHubStore((s) => s.error);
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(true);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Conectar GitHub</h2>
          <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-zinc-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Usa un Personal Access Token con permisos de Contents. El token no se envía a OpenRouter ni aparece en logs o exports.
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="github_pat_… o ghp_…"
          autoComplete="off"
          className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Recordar en este dispositivo
        </label>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <button
          type="button"
          disabled={connecting || !token.trim()}
          onClick={() => void connect(token, remember)}
          className="mt-4 w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {connecting ? "Conectando…" : "Conectar"}
        </button>
      </div>
    </div>
  );
}
