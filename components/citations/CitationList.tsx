"use client";

import type { Citation } from "@/types/capabilities";
import { CitationCard } from "./CitationCard";

export function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">Fuentes</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {citations.map((c, i) => (
          <CitationCard key={c.url} citation={c} index={i} />
        ))}
      </div>
    </div>
  );
}
