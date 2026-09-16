"use client";

import { ChevronLeft } from "lucide-react";
import type { CapabilityConfig, WebSearchDepth, WebSearchMode } from "@/types/capabilities";
import { cn } from "@/lib/utils/cn";

const MODES: { id: WebSearchMode | "off"; label: string; hint: string }[] = [
  { id: "auto", label: "Automático", hint: "El modelo decide cuándo buscar" },
  { id: "always", label: "Siempre", hint: "Buscar antes de responder" },
  { id: "off", label: "Desactivado", hint: "Sin búsqueda web" },
];

const RESULTS = [3, 5, 10];
const DEPTHS: { id: WebSearchDepth; label: string }[] = [
  { id: "fast", label: "Rápida" },
  { id: "normal", label: "Normal" },
  { id: "deep", label: "Profunda" },
];

export function WebSearchMenu({
  config,
  onBack,
  onChange,
  advanced = false,
}: {
  config: CapabilityConfig;
  onBack?: () => void;
  onChange: (config: CapabilityConfig) => void;
  advanced?: boolean;
}) {
  const mode: WebSearchMode | "off" = config.webSearch.enabled ? config.webSearch.mode : "off";

  const setMode = (next: WebSearchMode | "off") => {
    if (next === "off") {
      onChange({ ...config, webSearch: { ...config.webSearch, enabled: false } });
      return;
    }
    onChange({ ...config, webSearch: { ...config.webSearch, enabled: true, mode: next } });
  };

  return (
    <div className="py-1">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-1 flex items-center gap-1 px-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Buscar en Internet
        </button>
      )}
      {!onBack && <p className="px-1 pb-2 text-sm font-semibold">Buscar en Internet</p>}

      <div className="flex flex-col">
        {MODES.map((m) => {
          const selected = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className="flex items-start gap-2 rounded-xl px-2 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-600",
                )}
              >
                {selected && <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />}
              </span>
              <span>
                <span className="block text-sm text-zinc-800 dark:text-zinc-100">{m.label}</span>
                <span className="block text-[11px] text-zinc-500">{m.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {advanced && (
        <>
          <div className="my-2 border-t border-zinc-200 dark:border-zinc-700" />
          <p className="px-1 text-xs font-semibold text-zinc-500">Resultados</p>
          <div className="mt-1.5 flex gap-2 px-1">
            {RESULTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange({ ...config, webSearch: { ...config.webSearch, maxResults: n } })}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-sm",
                  config.webSearch.maxResults === n
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-3 px-1 text-xs font-semibold text-zinc-500">Profundidad</p>
          <div className="mt-1 flex flex-col">
            {DEPTHS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onChange({ ...config, webSearch: { ...config.webSearch, depth: d.id } })}
                className="flex items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border",
                    config.webSearch.depth === d.id
                      ? "border-zinc-900 dark:border-zinc-100"
                      : "border-zinc-300 dark:border-zinc-600",
                  )}
                >
                  {config.webSearch.depth === d.id && (
                    <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                  )}
                </span>
                {d.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
