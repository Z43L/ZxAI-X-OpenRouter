"use client";

import type { Citation } from "@/types/capabilities";
import { hostnameFromUrl } from "@/lib/citations/parse";
import { cn } from "@/lib/utils/cn";

export function InlineCitation({ citation, index }: { citation: Citation; index: number }) {
  const host = hostnameFromUrl(citation.url);
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      title={citation.title || host}
      className={cn(
        "group/cite relative mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full",
        "bg-zinc-200 px-1 text-[10px] font-semibold text-zinc-600 no-underline",
        "hover:bg-sky-100 hover:text-sky-700 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-sky-950 dark:hover:text-sky-300",
      )}
    >
      {index + 1}
      <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-20 hidden w-56 -translate-x-1/2 rounded-xl border border-zinc-200 bg-white p-2.5 text-left shadow-lg group-hover/cite:block dark:border-zinc-700 dark:bg-zinc-900">
        <span className="block text-[11px] font-medium text-zinc-500">{host}</span>
        {citation.title && (
          <span className="mt-0.5 block text-xs font-semibold text-zinc-800 dark:text-zinc-100">
            {citation.title}
          </span>
        )}
        {citation.content && (
          <span className="mt-1 block line-clamp-3 text-[11px] text-zinc-500">{citation.content}</span>
        )}
      </span>
    </a>
  );
}
