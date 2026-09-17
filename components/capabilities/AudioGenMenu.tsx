"use client";

import { ChevronLeft } from "lucide-react";
import type { AudioFormat, AudioVoice, CapabilityConfig } from "@/types/capabilities";
import { cn } from "@/lib/utils/cn";

const VOICES: AudioVoice[] = ["alloy", "echo", "fable", "onyx", "nova", "shimmer", "ash", "sage", "coral"];

const FORMATS: { id: AudioFormat; label: string }[] = [
  { id: "mp3", label: "MP3" },
  { id: "wav", label: "WAV" },
  { id: "flac", label: "FLAC" },
  { id: "opus", label: "Opus" },
  { id: "pcm16", label: "PCM16" },
];

export function AudioGenMenu({
  config,
  onBack,
  onChange,
}: {
  config: CapabilityConfig;
  onBack?: () => void;
  onChange: (config: CapabilityConfig) => void;
}) {
  const s = config.audioGen;
  return (
    <div className="py-1">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-1 flex items-center gap-1 px-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Generar audio
        </button>
      )}
      <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <input
          type="checkbox"
          checked={s.enabled}
          onChange={(e) =>
            onChange({ ...config, audioGen: { ...s, enabled: e.target.checked } })
          }
          className="accent-zinc-900 dark:accent-zinc-100"
        />
        Activar generación de audio
      </label>
      {s.enabled && (
        <>
          <p className="mt-2 px-1 text-xs font-semibold text-zinc-500">Voz</p>
          <div className="mt-1 grid grid-cols-3 gap-1.5 px-1">
            {VOICES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ ...config, audioGen: { ...s, voice: v } })}
                className={cn(
                  "rounded-lg py-1 text-xs",
                  s.voice === v
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="mt-3 px-1 text-xs font-semibold text-zinc-500">Formato</p>
          <div className="mt-1 flex flex-wrap gap-1.5 px-1">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onChange({ ...config, audioGen: { ...s, format: f.id } })}
                className={cn(
                  "rounded-lg px-2 py-1 text-xs",
                  s.format === f.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="mt-3 block px-1 text-xs text-zinc-600 dark:text-zinc-300">
            Duración (s): {s.durationSec}
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={s.durationSec}
              onChange={(e) =>
                onChange({
                  ...config,
                  audioGen: { ...s, durationSec: Number(e.target.value) },
                })
              }
              className="mt-1 w-full"
            />
          </label>
        </>
      )}
    </div>
  );
}
