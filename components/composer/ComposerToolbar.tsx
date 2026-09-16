"use client";

import { ArrowUp, Square } from "lucide-react";
import { Globe } from "lucide-react";
import type { CapabilityConfig } from "@/types/capabilities";
import { reasoningChipLabel } from "@/lib/capabilities";
import { cn } from "@/lib/utils/cn";
import { ModelPicker } from "../models/ModelPicker";
import { CapabilityButton } from "./CapabilityButton";
import { CapabilityChip } from "./CapabilityChip";
import { DiamondIcon, type CapabilityMenuView } from "./CapabilityMenu";

export function ComposerToolbar({
  config,
  draft,
  busy,
  menuOpen,
  onMenuToggle,
  onOpenView,
  onChange,
  onSubmit,
  onStop,
  onCloseMenu,
}: {
  config: CapabilityConfig;
  draft: string;
  busy: boolean;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onOpenView: (view: CapabilityMenuView) => void;
  onChange: (config: CapabilityConfig) => void;
  onSubmit: () => void;
  onStop: () => void;
  onCloseMenu: () => void;
}) {
  const reasoningLabel = reasoningChipLabel(config.reasoning.level);
  const canSend = !!draft.trim();

  return (
    <div className="flex items-center justify-between gap-1.5 px-2 pb-2">
      <div className="relative flex min-w-0 shrink-0 items-center gap-1.5 overflow-x-auto sm:flex-1 sm:shrink">
        <CapabilityButton
          open={menuOpen}
          active={config.webSearch.enabled || config.reasoning.level !== "auto"}
          onClick={onMenuToggle}
        />
        {config.webSearch.enabled && (
          <CapabilityChip
            icon={<Globe className="h-3 w-3" />}
            label="Web"
            title="Búsqueda web activa"
            onOpen={() => onOpenView("web")}
            onClear={() => onChange({ ...config, webSearch: { ...config.webSearch, enabled: false } })}
          />
        )}
        {reasoningLabel && (
          <CapabilityChip
            icon={<DiamondIcon className="h-3 w-3" />}
            label={reasoningLabel}
            title={`Razonamiento: ${reasoningLabel}`}
            onOpen={() => onOpenView("reasoning")}
            onClear={() => onChange({ ...config, reasoning: { level: "auto" } })}
          />
        )}
      </div>

      <div onMouseDown={onCloseMenu} className="flex min-w-0 flex-1 justify-center sm:flex-initial sm:justify-end">
        <ModelPicker variant="toolbar" align="center" />
      </div>

      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={busy ? onStop : onSubmit}
          disabled={!busy && !canSend}
          title={busy ? "Detener generación" : "Enviar"}
          className={cn(
            "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
            busy || canSend
              ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              : "cursor-not-allowed bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600",
          )}
        >
          <Square
            className={cn(
              "absolute h-3.5 w-3.5 fill-current transition-opacity duration-150",
              busy ? "opacity-100" : "opacity-0",
            )}
          />
          <ArrowUp
            className={cn("h-4 w-4 transition-opacity duration-150", busy ? "opacity-0" : "opacity-100")}
          />
        </button>
      </div>
    </div>
  );
}
