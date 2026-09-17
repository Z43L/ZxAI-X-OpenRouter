"use client";

import { ChevronLeft } from "lucide-react";
import type { CapabilityConfig, ImageQuality, ImageSize } from "@/types/capabilities";
import { cn } from "@/lib/utils/cn";

const SIZES: { id: ImageSize; label: string }[] = [
  { id: "1024x1024", label: "Cuadrado (1024×1024)" },
  { id: "1024x1792", label: "Vertical (1024×1792)" },
  { id: "1792x1024", label: "Horizontal (1792×1024)" },
  { id: "512x512", label: "Pequeño (512×512)" },
];

const QUALITIES: { id: ImageQuality; label: string }[] = [
  { id: "auto", label: "Automática" },
  { id: "low", label: "Baja" },
  { id: "medium", label: "Media" },
  { id: "high", label: "Alta" },
];

const FORMATS: { id: "png" | "jpeg" | "webp"; label: string }[] = [
  { id: "png", label: "PNG" },
  { id: "jpeg", label: "JPEG" },
  { id: "webp", label: "WebP" },
];

export function ImageGenMenu({
  config,
  onBack,
  onChange,
}: {
  config: CapabilityConfig;
  onBack?: () => void;
  onChange: (config: CapabilityConfig) => void;
}) {
  const s = config.imageGen;
  return (
    <div className="py-1">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-1 flex items-center gap-1 px-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Generar imagen
        </button>
      )}
      <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <input
          type="checkbox"
          checked={s.enabled}
          onChange={(e) =>
            onChange({ ...config, imageGen: { ...s, enabled: e.target.checked } })
          }
          className="accent-zinc-900 dark:accent-zinc-100"
        />
        Activar generación de imagen
      </label>
      {s.enabled && (
        <>
          <p className="mt-2 px-1 text-xs font-semibold text-zinc-500">Tamaño</p>
          <div className="mt-1 flex flex-col">
            {SIZES.map((sz) => {
              const selected = s.size === sz.id;
              return (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => onChange({ ...config, imageGen: { ...s, size: sz.id } })}
                  className="flex items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border",
                      selected ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-600",
                    )}
                  >
                    {selected && <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />}
                  </span>
                  {sz.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 px-1 text-xs font-semibold text-zinc-500">Calidad</p>
          <div className="mt-1 flex flex-col">
            {QUALITIES.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => onChange({ ...config, imageGen: { ...s, quality: q.id } })}
                className="flex items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border",
                    s.quality === q.id
                      ? "border-zinc-900 dark:border-zinc-100"
                      : "border-zinc-300 dark:border-zinc-600",
                  )}
                >
                  {s.quality === q.id && (
                    <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                  )}
                </span>
                {q.label}
              </button>
            ))}
          </div>
          <p className="mt-3 px-1 text-xs font-semibold text-zinc-500">Formato</p>
          <div className="mt-1 flex gap-2 px-1">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onChange({ ...config, imageGen: { ...s, format: f.id } })}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-sm",
                  s.format === f.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
