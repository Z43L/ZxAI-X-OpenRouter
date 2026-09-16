"use client";

import { memo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatContext, formatPricePair } from "@/lib/utils/format";
import { hasReasoning, hasTools, hasVision, isFreeModel, shortModelName } from "@/lib/utils/pricing";
import type { OpenRouterModelItem } from "@/types/openrouter";
import { ModelBadge } from "./ModelBadge";

export const ModelRow = memo(function ModelRow({
  model,
  selected,
  onSelect,
}: {
  model: OpenRouterModelItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const free = isFreeModel(model);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left transition-colors",
        selected
          ? "bg-zinc-100 dark:bg-zinc-800"
          : "hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60",
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {shortModelName(model)}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {formatPricePair(model.pricing?.prompt, model.pricing?.completion)}
          </span>
          {selected && <Check className="h-4 w-4 text-emerald-600" />}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <ModelBadge label={model.id.split("/")[0] ?? "otros"} tone="neutral" />
        {free && <ModelBadge label="Gratis" tone="green" />}
        {hasReasoning(model) && <ModelBadge label="Reasoning" tone="violet" />}
        {hasVision(model) && <ModelBadge label="Vision" tone="blue" />}
        {hasTools(model) && <ModelBadge label="Tools" tone="amber" />}
        {(model.context_length ?? 0) > 0 && (
          <ModelBadge label={formatContext(model.context_length)} tone="neutral" />
        )}
      </div>
    </button>
  );
});
