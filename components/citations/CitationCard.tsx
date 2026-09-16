"use client";

import { useState } from "react";
import { hostnameFromUrl } from "@/lib/citations/parse";
import type { Citation } from "@/types/capabilities";

export function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  const [open, setOpen] = useState(false);
  const host = hostnameFromUrl(citation.url);
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      className="relative min-w-[160px] max-w-[220px] shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
    >
      <p className="truncate text-[11px] font-medium text-zinc-500">{host}</p>
      <p className="mt-0.5 line-clamp-2 text-xs font-medium text-zinc-800 dark:text-zinc-100">
        {citation.title || `Fuente ${index + 1}`}
      </p>
      {open && (citation.content || citation.title) && (
        <span className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-64 rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <span className="block text-[11px] font-medium text-zinc-500">{host}</span>
          {citation.title && (
            <span className="mt-1 block text-xs font-semibold text-zinc-800 dark:text-zinc-100">
              {citation.title}
            </span>
          )}
          {citation.content && (
            <span className="mt-1 block line-clamp-4 text-[11px] leading-relaxed text-zinc-500">
              {citation.content}
            </span>
          )}
        </span>
      )}
    </a>
  );
}
