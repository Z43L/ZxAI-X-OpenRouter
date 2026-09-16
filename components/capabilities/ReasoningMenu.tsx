"use client";

import { ChevronLeft } from "lucide-react";
import type { CapabilityConfig, ReasoningLevel } from "@/types/capabilities";
import type { OpenRouterModelItem } from "@/types/openrouter";
import { canDisableReasoning, reasoningMenuLabel, supportsReasoning } from "@/lib/capabilities";
import { cn } from "@/lib/utils/cn";

const LEVELS: ReasoningLevel[] = ["auto", "off", "low", "medium", "high"];

export function ReasoningMenu({
  config,
  model,
  onBack,
  onChange,
}: {
  config: CapabilityConfig;
  model?: OpenRouterModelItem;
  onBack?: () => void;
  onChange: (config: CapabilityConfig) => void;
}) {
  const available = supportsReasoning(model);
  const allowOff = canDisableReasoning(model);

  return (
    <div className="py-1">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-1 flex items-center gap-1 px-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Razonamiento
        </button>
      )}
      {!onBack && <p className="px-1 pb-2 text-sm font-semibold">Razonamiento</p>}
      {!available && (
        <p className="px-1 pb-2 text-xs text-zinc-500">No disponible para este modelo</p>
      )}
      <div className="flex flex-col">
        {LEVELS.map((level) => {
          const disabled = !available || (level === "off" && !allowOff);
          const selected = config.reasoning.level === level;
          return (
            <button
              key={level}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange({ ...config, reasoning: { level } })
              }
              className={cn(
                "flex items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition-colors",
                disabled
                  ? "cursor-not-allowed text-zinc-400"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full border",
                  selected ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-600",
                )}
              >
                {selected && <span className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />}
              </span>
              {reasoningMenuLabel(level)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
