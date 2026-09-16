"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function CapabilityButton({
  open,
  active,
  onClick,
}: {
  open: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
      aria-expanded={open}
      aria-haspopup="menu"
      title="Capacidades"
      className={cn(
        "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors",
        "hover:bg-zinc-200/80 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
        open && "bg-zinc-200/80 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
      )}
    >
      <Plus className="h-4 w-4" />
      {active && (
        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
      )}
    </button>
  );
}
