"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipForward, Trash2 } from "lucide-react";
import type { StudioQueueState } from "@/lib/studio/audio-queue";
import { StudioAudioQueue } from "@/lib/studio/audio-queue";
import { useStudioStore } from "@/store/studio-store";
import type { StudioClip } from "@/types/studio";

let queueSingleton: StudioAudioQueue | null = null;

function getQueue(): StudioAudioQueue {
  if (!queueSingleton) {
    queueSingleton = new StudioAudioQueue();
  }
  return queueSingleton;
}

function fmtMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "00:00";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function clipsKey(clips: StudioClip[]): string {
  return clips.map((c) => c.id).join("|");
}

export function StudioPlayer() {
  const queue = getQueue();
  const sessions = useStudioStore((s) => s.sessions);
  const activeId = useStudioStore((s) => s.activeSessionId);
  const [state, setState] = useState<StudioQueueState>(queue.state());
  const lastSyncedRef = useRef<string>("");

  useEffect(() => {
    return queue.subscribe(setState);
  }, [queue]);

  useEffect(() => {
    return queue.onClipEnded(() => {
      /* el propio queue gestiona el avance al siguiente clip */
    });
  }, [queue]);

  const activeClips = useMemo(() => {
    if (!activeId) return [];
    return sessions.find((s) => s.id === activeId)?.clips ?? [];
  }, [sessions, activeId]);

  useEffect(() => {
    if (state.current !== null) {
      lastSyncedRef.current = clipsKey(state.upcoming);
      return;
    }
    const pastIds = new Set(state.past.map((p) => p.id));
    const upcoming = activeClips.filter((c) => !pastIds.has(c.id));
    const signature = clipsKey(upcoming);
    if (signature === lastSyncedRef.current) return;
    lastSyncedRef.current = signature;
    queue.setQueue(upcoming);
  }, [activeClips, state.current, state.past, queue]);

  const handleTogglePlay = () => {
    if (state.playing) {
      queue.pause();
    } else {
      void queue.start();
    }
  };

  const handleSkip = () => {
    queue.skip();
  };

  const handleClearHistory = () => {
    queue.setQueue([]);
    lastSyncedRef.current = "";
  };

  const hasContent = state.current || state.upcoming.length > 0;

  return (
    <div className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {state.current ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {state.current.prompt}
              </p>
              <p className="text-[11px] text-zinc-500">{state.current.model}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {state.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                title="Saltar al siguiente clip"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">Sin clips en cola. Genera uno desde el chat.</p>
        )}
        {state.current && state.durationMs > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span className="w-10 text-right">{fmtMs(state.positionMs)}</span>
            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="absolute top-0 left-0 h-full bg-amber-500 transition-[width] duration-200"
                style={{ width: `${Math.min(100, (state.positionMs / state.durationMs) * 100)}%` }}
              />
            </div>
            <span className="w-10">{fmtMs(state.durationMs)}</span>
          </div>
        )}
        {hasContent && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span>En cola: {state.upcoming.length}</span>
            <button
              type="button"
              onClick={handleClearHistory}
              className="ml-auto inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <Trash2 className="h-3 w-3" /> Vaciar cola
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export type { StudioClip };
