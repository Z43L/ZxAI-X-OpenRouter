"use client";

import { memo } from "react";
import { cn } from "@/lib/utils/cn";

export const ModelBadge = memo(function ModelBadge({
  label,
  tone = "neutral",
  title,
}: {
  label: string;
  tone?: "neutral" | "green" | "violet" | "amber" | "blue";
  title?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    blue: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  };
  return (
    <span
      title={title}
      className={cn("rounded px-1.5 py-px text-[10px] font-semibold whitespace-nowrap", tones[tone])}
    >
      {label}
    </span>
  );
});
