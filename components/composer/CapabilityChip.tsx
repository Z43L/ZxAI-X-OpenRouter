"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function CapabilityChip({
  icon,
  label,
  title,
  onOpen,
  onClear,
}: {
  icon: React.ReactNode;
  label: string;
  title?: string;
  onOpen: () => void;
  onClear: () => void;
}) {
  return (
    <span
      title={title}
      className="inline-flex max-w-[160px] items-center gap-1 rounded-full border border-zinc-200 bg-white py-0.5 pr-0.5 pl-1.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
    >
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onOpen}
        className="inline-flex min-w-0 items-center gap-1 truncate"
      >
        <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{icon}</span>
        <span className="truncate">{label}</span>
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onClear}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-400",
          "hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100",
        )}
        aria-label={`Desactivar ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
