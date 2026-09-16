"use client";

import { memo } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AUTO_MODEL_ID } from "@/types/openrouter";

const TABS = [
  { id: "all", label: "Todos" },
  { id: "free", label: "Gratis" },
  { id: "fast", label: "Rápidos" },
  { id: "reasoning", label: "Reasoning" },
] as const;

export const ModelFiltersBar = memo(function ModelFiltersBar({
  tab,
  onTab,
}: {
  tab: string;
  onTab: (t: "all" | "free" | "fast" | "reasoning") => void;
}) {
  return (
    <div className="flex gap-1 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onTab(t.id)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            tab === t.id
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
});

export function AutoRow({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
        selected ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60",
      )}
    >
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
      <span>
        <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          ✦ Auto <span className="font-mono text-[10px] font-normal text-zinc-400">{AUTO_MODEL_ID}</span>
        </span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
          Elige el mejor modelo automáticamente según la tarea
        </span>
      </span>
    </button>
  );
}
