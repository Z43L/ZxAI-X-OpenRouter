"use client";

import { ChevronLeft } from "lucide-react";
import type { CapabilityConfig, VideoAspectRatio, VideoResolution } from "@/types/capabilities";
import { cn } from "@/lib/utils/cn";

const ASPECTS: { id: VideoAspectRatio; label: string }[] = [
  { id: "16:9", label: "16:9 (horizontal)" },
  { id: "9:16", label: "9:16 (vertical)" },
  { id: "1:1", label: "1:1 (cuadrado)" },
  { id: "4:3", label: "4:3" },
  { id: "21:9", label: "21:9 (cinemático)" },
];

const RES: { id: VideoResolution; label: string }[] = [
  { id: "480p", label: "480p" },
  { id: "720p", label: "720p (HD)" },
  { id: "1080p", label: "1080p (Full HD)" },
];

const FPS: (24 | 30 | 60)[] = [24, 30, 60];

export function VideoGenMenu({
  config,
  onBack,
  onChange,
}: {
  config: CapabilityConfig;
  onBack?: () => void;
  onChange: (config: CapabilityConfig) => void;
}) {
  const s = config.videoGen;
  return (
    <div className="py-1">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-1 flex items-center gap-1 px-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Generar vídeo
        </button>
      )}
      <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <input
          type="checkbox"
          checked={s.enabled}
          onChange={(e) =>
            onChange({ ...config, videoGen: { ...s, enabled: e.target.checked } })
          }
          className="accent-zinc-900 dark:accent-zinc-100"
        />
        Activar generación de vídeo
      </label>
      {s.enabled && (
        <>
          <p className="mt-2 px-1 text-xs font-semibold text-zinc-500">Formato</p>
          <div className="mt-1 flex flex-col">
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onChange({ ...config, videoGen: { ...s, aspectRatio: a.id } })}
                className="flex items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border",
                    s.aspectRatio === a.id
                      ? "border-zinc-900 dark:border-zinc-100"
                      : "border-zinc-300 dark:border-zinc-600",
                  )}
                >
                  {s.aspectRatio === a.id && (
                    <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                  )}
                </span>
                {a.label}
              </button>
            ))}
          </div>
          <p className="mt-3 px-1 text-xs font-semibold text-zinc-500">Resolución</p>
          <div className="mt-1 flex gap-2 px-1">
            {RES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onChange({ ...config, videoGen: { ...s, resolution: r.id } })}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-sm",
                  s.resolution === r.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <label className="mt-3 block px-1 text-xs text-zinc-600 dark:text-zinc-300">
            Duración (s): {s.durationSec}
            <input
              type="range"
              min={2}
              max={60}
              step={1}
              value={s.durationSec}
              onChange={(e) =>
                onChange({
                  ...config,
                  videoGen: { ...s, durationSec: Number(e.target.value) },
                })
              }
              className="mt-1 w-full"
            />
          </label>
          <p className="mt-2 px-1 text-xs font-semibold text-zinc-500">FPS</p>
          <div className="mt-1 flex gap-2 px-1">
            {FPS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onChange({ ...config, videoGen: { ...s, fps: f } })}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-sm",
                  s.fps === f
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
