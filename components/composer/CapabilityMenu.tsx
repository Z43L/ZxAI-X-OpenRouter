"use client";

import { useEffect, useRef } from "react";
import { ChevronRight, Globe, Maximize2, Image as ImageIcon, Music, Video } from "lucide-react";
import type { CapabilityConfig } from "@/types/capabilities";
import { modelSupportsModality } from "@/types/capabilities";
import type { OpenRouterModelItem } from "@/types/openrouter";
import { reasoningMenuLabel, supportsReasoning } from "@/lib/capabilities";
import { cn } from "@/lib/utils/cn";
import { BottomSheet } from "../ui/BottomSheet";
import { ReasoningMenu } from "../capabilities/ReasoningMenu";
import { WebSearchMenu } from "../capabilities/WebSearchMenu";
import { ImageGenMenu } from "../capabilities/ImageGenMenu";
import { VideoGenMenu } from "../capabilities/VideoGenMenu";
import { AudioGenMenu } from "../capabilities/AudioGenMenu";

export type CapabilityMenuView =
  | "root"
  | "reasoning"
  | "web"
  | "image-gen"
  | "video-gen"
  | "audio-gen";

function DiamondIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        d="M8 1.4 14.6 8 8 14.6 1.4 8 8 1.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuBody({
  view,
  config,
  model,
  showHeader,
  onChange,
  onView,
  onExpand,
  onClose,
}: {
  view: CapabilityMenuView;
  config: CapabilityConfig;
  model?: OpenRouterModelItem;
  showHeader: boolean;
  onChange: (config: CapabilityConfig) => void;
  onView: (view: CapabilityMenuView) => void;
  onExpand: () => void;
  onClose: () => void;
}) {
  const reasoningOk = supportsReasoning(model);
  const imageOk = modelSupportsModality(model, "image");
  const audioOk = modelSupportsModality(model, "audio");
  const webOn = config.webSearch.enabled;
  const imgOn = config.imageGen.enabled;
  const vidOn = config.videoGen.enabled;
  const audOn = config.audioGen.enabled;

  if (view === "reasoning") {
    return (
      <ReasoningMenu
        config={config}
        model={model}
        onBack={() => onView("root")}
        onChange={(next) => {
          onChange(next);
        }}
      />
    );
  }

  if (view === "web") {
    return (
      <WebSearchMenu
        config={config}
        advanced
        onBack={() => onView("root")}
        onChange={onChange}
      />
    );
  }

  if (view === "image-gen") {
    return (
      <ImageGenMenu
        config={config}
        onBack={() => onView("root")}
        onChange={onChange}
      />
    );
  }

  if (view === "video-gen") {
    return (
      <VideoGenMenu
        config={config}
        onBack={() => onView("root")}
        onChange={onChange}
      />
    );
  }

  if (view === "audio-gen") {
    return (
      <AudioGenMenu
        config={config}
        onBack={() => onView("root")}
        onChange={onChange}
      />
    );
  }

  return (
    <div className="py-0.5">
      {showHeader && (
        <p className="px-1 pb-2 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
          Capacidades
        </p>
      )}

      <button
        type="button"
        onClick={() =>
          onChange({
            ...config,
            webSearch: { ...config.webSearch, enabled: !webOn, mode: config.webSearch.mode || "auto" },
          })
        }
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <Globe className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Buscar en Internet
          </span>
          <span className="block text-[11px] text-zinc-500">
            {webOn ? "Información actual" : "Puede generar costes adicionales"}
          </span>
        </span>
        <span
          className={cn(
            "h-3.5 w-3.5 shrink-0 rounded-full border",
            webOn
              ? "border-sky-500 bg-sky-500"
              : "border-zinc-300 bg-transparent dark:border-zinc-600",
          )}
          aria-hidden="true"
        />
      </button>

      <button
        type="button"
        disabled={!reasoningOk}
        onClick={() => onView("reasoning")}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left",
          reasoningOk
            ? "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            : "cursor-not-allowed opacity-50",
        )}
      >
        <DiamondIcon className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Razonamiento
          </span>
          <span className="block text-[11px] text-zinc-500">
            {reasoningOk
              ? reasoningMenuLabel(config.reasoning.level)
              : "No disponible para este modelo"}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
      </button>

      <button
        type="button"
        disabled={!imageOk}
        onClick={() => onView("image-gen")}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left",
          imageOk
            ? "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            : "cursor-not-allowed opacity-50",
        )}
      >
        <ImageIcon className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Generar imagen
          </span>
          <span className="block text-[11px] text-zinc-500">
            {imgOn
              ? `${config.imageGen.size} · ${config.imageGen.quality}`
              : imageOk
                ? "Activar generación de imagen"
                : "El modelo actual no soporta imagen"}
          </span>
        </span>
        <span
          className={cn(
            "h-3.5 w-3.5 shrink-0 rounded-full border",
            imgOn
              ? "border-emerald-500 bg-emerald-500"
              : "border-zinc-300 bg-transparent dark:border-zinc-600",
          )}
          aria-hidden="true"
        />
      </button>

      <button
        type="button"
        onClick={() => onView("video-gen")}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <Video className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Generar vídeo
          </span>
          <span className="block text-[11px] text-zinc-500">
            {vidOn
              ? `${config.videoGen.aspectRatio} · ${config.videoGen.resolution} · ${config.videoGen.durationSec}s`
              : "Activar generación de vídeo"}
          </span>
        </span>
        <span
          className={cn(
            "h-3.5 w-3.5 shrink-0 rounded-full border",
            vidOn
              ? "border-fuchsia-500 bg-fuchsia-500"
              : "border-zinc-300 bg-transparent dark:border-zinc-600",
          )}
          aria-hidden="true"
        />
      </button>

      <button
        type="button"
        disabled={!audioOk}
        onClick={() => onView("audio-gen")}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left",
          audioOk
            ? "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            : "cursor-not-allowed opacity-50",
        )}
      >
        <Music className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Generar audio
          </span>
          <span className="block text-[11px] text-zinc-500">
            {audOn
              ? `${config.audioGen.voice} · ${config.audioGen.format}`
              : audioOk
                ? "Activar generación de audio"
                : "El modelo actual no soporta audio"}
          </span>
        </span>
        <span
          className={cn(
            "h-3.5 w-3.5 shrink-0 rounded-full border",
            audOn
              ? "border-amber-500 bg-amber-500"
              : "border-zinc-300 bg-transparent dark:border-zinc-600",
          )}
          aria-hidden="true"
        />
      </button>

      <div className="my-1.5 border-t border-zinc-200 dark:border-zinc-700" />

      <button
        type="button"
        onClick={() => {
          onExpand();
          onClose();
        }}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <Maximize2 className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Expandir editor</span>
      </button>
    </div>
  );
}

export function CapabilityMenu({
  open,
  view,
  isMobile,
  config,
  model,
  onClose,
  onView,
  onChange,
  onExpand,
}: {
  open: boolean;
  view: CapabilityMenuView;
  isMobile: boolean;
  config: CapabilityConfig;
  model?: OpenRouterModelItem;
  onClose: () => void;
  onView: (view: CapabilityMenuView) => void;
  onChange: (config: CapabilityConfig) => void;
  onExpand: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (view !== "root") onView("root");
      else onClose();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, onView, view]);

  if (!open) return null;

  const body = (
    <MenuBody
      view={view}
      config={config}
      model={model}
      showHeader={!isMobile}
      onChange={onChange}
      onView={onView}
      onExpand={onExpand}
      onClose={onClose}
    />
  );

  if (isMobile) {
    const titles: Record<CapabilityMenuView, string | undefined> = {
      root: "Capacidades",
      reasoning: undefined,
      web: undefined,
      "image-gen": undefined,
      "video-gen": undefined,
      "audio-gen": undefined,
    };
    return (
      <BottomSheet open={open} onClose={onClose} title={titles[view]}>
        {body}
      </BottomSheet>
    );
  }

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute bottom-full left-0 z-50 mb-2 w-[min(320px,calc(100vw-2rem))] origin-bottom-left rounded-2xl border border-zinc-200/80 bg-white/90 p-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-zinc-700/80 dark:bg-zinc-900/90"
      style={{ animation: "cap-menu-in 140ms ease-out" }}
    >
      {body}
    </div>
  );
}

export { DiamondIcon };
