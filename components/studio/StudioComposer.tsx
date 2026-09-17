"use client";

import { useState, useRef } from "react";
import { AlertCircle, Send, Square, Music } from "lucide-react";
import { useStudioStore } from "@/store/studio-store";
import { useSettingsStore } from "@/store/settings-store";
import { useModelStore } from "@/store/model-store";
import { cn } from "@/lib/utils/cn";
import { StudioModelPicker } from "./StudioModelPicker";

const PRESETS = [
  { label: "Lo-fi chill", prompt: "Lo-fi chill, 80 BPM, piano + vinyl crackle" },
  { label: "Synthwave 80s", prompt: "Synthwave años 80, 110 BPM, sintetizadores analógicos" },
  { label: "Bossa nova", prompt: "Bossa nova, 120 BPM, nylon guitar + suave percusión" },
  { label: "Ambient espacial", prompt: "Ambient espacial, drone pads, campo profundo" },
  { label: "Trap oscuro", prompt: "Trap oscuro, 140 BPM, 808 + hi-hats rápidos" },
];

export function StudioComposer() {
  const [draft, setDraft] = useState("");
  const sessions = useStudioStore((s) => s.sessions);
  const activeId = useStudioStore((s) => s.activeSessionId);
  const running = useStudioStore((s) => s.running);
  const start = useStudioStore((s) => s.start);
  const stop = useStudioStore((s) => s.stop);
  const newSession = useStudioStore((s) => s.newSession);
  const updateParams = useStudioStore((s) => s.updateParams);
  const appendUserMessage = useStudioStore((s) => s.appendUserMessage);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);
  const loadError = useModelStore((s) => s.loadError);
  const ref = useRef<HTMLTextAreaElement>(null);

  const session = activeId ? sessions.find((s) => s.id === activeId) ?? null : null;
  const selectedModel = session?.params.model ?? "";
  const hasCatalogError = Boolean(loadError);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    if (!apiKey) {
      setSettingsOpen(true);
      setDraft("");
      return;
    }
    if (!selectedModel) {
      setDraft("");
      return;
    }
    setDraft("");
    if (!session) {
      await newSession(text.slice(0, 40));
    } else {
      await updateParams({ prompt: text });
      await appendUserMessage(text);
    }
    void start();
  };

  const handleStop = () => {
    stop();
  };

  const showMissingModelWarning = !selectedModel && draft.trim().length > 0;

  return (
    <div className="border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setDraft(p.prompt)}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Music className="h-3 w-3" />
            <span>Modelo:</span>
            <StudioModelPicker />
          </div>
        </div>
        {hasCatalogError && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              No pude cargar el catálogo de OpenRouter ({loadError}). Configura tu API key en
              Ajustes o recarga.
            </span>
          </div>
        )}
        {showMissingModelWarning && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Selecciona un modelo de audio en el desplegable superior antes de enviar.
            </span>
          </div>
        )}
        <div
          className={cn(
            "composer-panel relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-50 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-zinc-700/80 dark:bg-zinc-900",
          )}
        >
          <textarea
            ref={ref}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Describe la música que quieres generar..."
            className="w-full resize-none border-0 bg-transparent px-4 py-2.5 text-[15px] outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (!running) void handleSend();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <p className="text-[11px] text-zinc-400">
              {session ? session.name : "Pulsa enviar para crear una sesión y comenzar."}
            </p>
            <button
              type="button"
              onClick={running ? handleStop : () => void handleSend()}
              disabled={running || !draft.trim() || !selectedModel}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                running || (draft.trim() && selectedModel)
                  ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  : "cursor-not-allowed bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600",
              )}
              title={
                running
                  ? "Detener"
                  : !selectedModel
                    ? "Selecciona un modelo primero"
                    : "Generar"
              }
            >
              {running ? <Square className="h-3.5 w-3.5 fill-current" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
