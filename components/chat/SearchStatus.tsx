"use client";

import { Globe, Sparkles } from "lucide-react";
import type { SearchPhase } from "@/types/capabilities";

export function SearchStatus({
  phase,
  sourceCount,
}: {
  phase?: SearchPhase;
  sourceCount?: number;
}) {
  if (!phase || phase === "idle" || phase === "writing") return null;
  const label =
    phase === "sources" && sourceCount
      ? `Consultando ${sourceCount} fuentes...`
      : "Buscando en Internet...";
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[12px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
      {phase === "sources" ? (
        <Sparkles className="h-3 w-3 animate-pulse text-violet-500" />
      ) : (
        <Globe className="h-3 w-3 animate-pulse text-sky-500" />
      )}
      {label}
    </div>
  );
}
