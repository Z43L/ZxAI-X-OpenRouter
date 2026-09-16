"use client";

import { FolderOpen, FolderGit2, Terminal } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useGitHubStore } from "@/store/github-store";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function StartScreen() {
  const recents = useWorkspaceStore((s) => s.recents);
  const openLocal = useWorkspaceStore((s) => s.openLocalFolder);
  const reconnect = useWorkspaceStore((s) => s.reconnectLocal);
  const openGitHub = useWorkspaceStore((s) => s.openGitHubRepo);
  const token = useGitHubStore((s) => s.token);
  const setConnectOpen = useGitHubStore((s) => s.setConnectOpen);
  const setPickerOpen = useGitHubStore((s) => s.setPickerOpen);

  return (
    <div className="flex h-full flex-1 flex-col overflow-auto bg-white px-4 py-8 pb-[max(2.5rem,calc(env(safe-area-inset-bottom,0px)+1.5rem))] sm:px-6 sm:py-10 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Code</p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">¿En qué quieres trabajar?</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          El editor habla con un workspace. No ejecuta código en tu máquina.
        </p>

        <div className="mt-8 grid gap-3">
          <StartCard
            icon={FolderOpen}
            title="Abrir carpeta local"
            body="Trabaja sobre los archivos de tu dispositivo o crea un proyecto en el almacenamiento de la app."
            onClick={() => void openLocal().catch((e) => alert(e instanceof Error ? e.message : String(e)))}
          />
          <StartCard
            icon={FolderGit2}
            title="Abrir repositorio de GitHub"
            body="Explora y edita vía API. Los cambios viven en un buffer hasta que haces commit."
            onClick={() => (token ? setPickerOpen(true) : setConnectOpen(true))}
          />
          <StartCard
            icon={Terminal}
            title="Conectar remoto"
            body="Terminal SSH a través de un gateway WebSocket propio. Disponible en una versión posterior."
            disabled
          />
        </div>

        {recents.length > 0 && (
          <div className="mt-10">
            <h3 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Recientes</h3>
            <ul className="mt-2 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {recents.slice(0, 12).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (r.type === "local") {
                        void reconnect(r.id).catch((e) => alert(e instanceof Error ? e.message : String(e)));
                      } else if (r.type === "github" && r.github) {
                        if (!token) {
                          setConnectOpen(true);
                          return;
                        }
                        void openGitHub(r.github.owner, r.github.repo, r.github.branch).catch((e) =>
                          alert(e instanceof Error ? e.message : String(e)),
                        );
                      }
                    }}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{r.name}</span>
                    <span className="ml-3 flex shrink-0 items-center gap-2 text-xs text-zinc-400">
                      <span className="capitalize">{r.type}</span>
                      <span>{timeAgo(r.lastOpened)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function StartCard({
  icon: Icon,
  title,
  body,
  onClick,
  disabled,
}: {
  icon: typeof FolderOpen;
  title: string;
  body: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-colors dark:border-zinc-800 dark:bg-zinc-900",
        disabled ? "cursor-not-allowed opacity-50" : "hover:border-zinc-400 hover:bg-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800",
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{body}</p>
      </div>
    </button>
  );
}
