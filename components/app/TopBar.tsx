"use client";

import { MessageSquare, Code2 } from "lucide-react";
import { PanelLeft, Plus, Settings } from "lucide-react";
import { selectActiveChat, useChatStore } from "@/store/chat-store";
import { selectEffectiveModel, useModelStore } from "@/store/model-store";
import { useSettingsStore } from "@/store/settings-store";
import { useAppStore } from "@/store/app-store";
import { ChatUsage } from "../usage/ChatUsage";
import { ModelPicker } from "../models/ModelPicker";
import { cn } from "@/lib/utils/cn";

export function TopBar() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const newChat = useChatStore((s) => s.newChat);
  const activeChat = useChatStore(selectActiveChat);
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);
  const effectiveModel = useModelStore(selectEffectiveModel);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);

  return (
    <header className="flex shrink-0 items-center gap-1 border-b border-zinc-200 px-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] pb-2 sm:px-3 dark:border-zinc-800">
      {mode === "chat" && (
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? "Ocultar sidebar" : "Mostrar sidebar"}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      )}
      {mode === "chat" && (
        <button
          type="button"
          onClick={() => newChat(effectiveModel)}
          title="Nuevo chat"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <Plus className="h-5 w-5" />
        </button>
      )}

      <div className="flex items-center gap-1.5 min-w-0 px-1">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-950">
          Zx
        </span>
        <h1 className="hidden xs:inline truncate text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          ZxAI
        </h1>
      </div>

      <div className="mx-auto flex items-center rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-900">
        <ModeBtn active={mode === "chat"} onClick={() => setMode("chat")} icon={MessageSquare} label="Chat" />
        <ModeBtn active={mode === "code"} onClick={() => setMode("code")} icon={Code2} label="Code" />
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-1">
        {mode === "chat" && activeChat && <ChatUsage chat={activeChat} />}
        {mode === "code" && <ModelPicker variant="toolbar" align="end" drop="down" />}

        {!apiKey && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="mr-1 hidden rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 sm:block dark:bg-amber-950 dark:text-amber-300"
            title="Configura tu API key de OpenRouter"
          >
            Sin API key
          </button>
        )}

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          title="Ajustes"
          className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function ModeBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MessageSquare;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
        active ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

