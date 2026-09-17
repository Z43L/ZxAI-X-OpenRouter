"use client";

import { useEffect, useState } from "react";
import { useChatStore } from "@/store/chat-store";
import { useModelStore } from "@/store/model-store";
import { useSettingsStore } from "@/store/settings-store";
import { useAppStore } from "@/store/app-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useGitHubStore } from "@/store/github-store";
import { useProjectStore } from "@/store/project-store";
import { Sidebar } from "../sidebar/Sidebar";
import { TopBar } from "./TopBar";
import { ChatWindow } from "../chat/ChatWindow";
import { Composer } from "../composer/Composer";
import { SettingsModal } from "../settings/SettingsModal";
import { CodeWorkbench } from "../code/workbench/CodeWorkbench";
import { NativeInit } from "./NativeInit";
import { cn } from "@/lib/utils/cn";

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    if (
      event.reason?.type === "cancelation" ||
      event.reason?.msg === "operation is manually canceled"
    ) {
      event.preventDefault();
    }
  });
}

export function AppShell() {
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const hydrateModels = useModelStore((s) => s.hydrate);
  const hydrateChats = useChatStore((s) => s.hydrate);
  const hydrateWorkspaces = useWorkspaceStore((s) => s.hydrate);
  const hydrateGitHub = useGitHubStore((s) => s.hydrate);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const modelsHydrated = useModelStore((s) => s.hydrated);
  const chatsHydrated = useChatStore((s) => s.hydrated);
  const workspacesHydrated = useWorkspaceStore((s) => s.hydrated);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const mode = useAppStore((s) => s.mode);

  const [draft, setDraft] = useState("");

  useEffect(() => {
    hydrateSettings();
    void hydrateWorkspaces();
    void hydrateGitHub();
    void useProjectStore.getState().hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!settingsHydrated || modelsHydrated) return;
    hydrateModels(apiKey || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsHydrated, modelsHydrated]);

  useEffect(() => {
    if (!modelsHydrated || chatsHydrated) return;
    hydrateChats(useModelStore.getState().selectedModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelsHydrated, chatsHydrated]);

  if (!settingsHydrated || !modelsHydrated || !chatsHydrated || !workspacesHydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white dark:bg-zinc-950">
        <p className="animate-pulse text-sm text-zinc-500">Cargando ZxAI...</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {mode === "chat" && (
        <aside
          className={cn(
            "hidden shrink-0 border-r border-zinc-200 transition-all duration-200 lg:block dark:border-zinc-800",
            sidebarOpen ? "w-[260px]" : "w-0 overflow-hidden border-r-0",
          )}
        >
          <div className="h-full w-[260px] bg-zinc-50 dark:bg-zinc-900">
            <Sidebar />
          </div>
        </aside>
      )}

      {mode === "chat" && sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute top-0 left-0 h-full w-[280px] bg-zinc-50 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] shadow-xl dark:bg-zinc-900">
            <Sidebar />
          </aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950">
        <TopBar />
        {mode === "chat" ? (
          <>
            <ChatWindow draft={draft} onDraftChange={setDraft} />
            <Composer draft={draft} onDraftChange={setDraft} />
          </>
        ) : mode === "code" ? (
          <CodeWorkbench />
        ) : (
          // mode === "studio" se trata como code por ahora: Studio está oculto
          // en la UI pero el código se conserva para iteraciones futuras.
          <CodeWorkbench />
        )}
      </main>

      <SettingsModal />
      <NativeInit />
    </div>
  );
}
