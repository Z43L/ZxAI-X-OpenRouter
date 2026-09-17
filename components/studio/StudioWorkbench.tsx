"use client";

import { Headphones } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useAppStore } from "@/store/app-store";
import { useStudioStore } from "@/store/studio-store";
import { useModelStore } from "@/store/model-store";
import { useSettingsStore } from "@/store/settings-store";
import { StudioSidebar } from "./StudioSidebar";
import { StudioPlayer } from "./StudioPlayer";
import { StudioChat } from "./StudioChat";
import { StudioLibrary } from "./StudioLibrary";
import { StudioComposer } from "./StudioComposer";
import { StudioModePicker } from "./StudioModePicker";
import { StudioModelPicker } from "./StudioModelPicker";
import type { StudioClip } from "@/types/studio";

function useStudioLibraryClips(): StudioClip[] {
  const sessions = useStudioStore((s) => s.sessions);
  const activeSessionId = useStudioStore((s) => s.activeSessionId);
  return useMemo(() => {
    if (!activeSessionId) return [];
    return sessions.find((x) => x.id === activeSessionId)?.clips ?? [];
  }, [sessions, activeSessionId]);
}

export function StudioWorkbench() {
  const hydrate = useStudioStore((s) => s.hydrate);
  const setMode = useAppStore((s) => s.setMode);
  const clips = useStudioLibraryClips();
  const models = useModelStore((s) => s.models);
  const loading = useModelStore((s) => s.loading);
  const loadError = useModelStore((s) => s.loadError);
  const refreshModels = useModelStore((s) => s.refresh);
  const apiKey = useSettingsStore((s) => s.apiKey);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (models.length === 0 && apiKey && !loading && !loadError) {
      void refreshModels(apiKey);
    }
  }, [models.length, apiKey, loading, loadError, refreshModels]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2">
          <Headphones className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold">Studio</h2>
          <StudioModelPicker />
          <StudioModePicker />
        </div>
        <button
          type="button"
          onClick={() => setMode("chat")}
          className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Volver al chat
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[220px] shrink-0 border-r border-zinc-200 bg-white lg:block dark:border-zinc-800 dark:bg-zinc-950">
          <StudioSidebar />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <StudioPlayer />
          <StudioChat />
          <StudioComposer />
        </div>
      </div>
      <div className="border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            Biblioteca de clips
          </h3>
          <StudioLibrary clips={clips} />
        </div>
      </div>
    </div>
  );
}
