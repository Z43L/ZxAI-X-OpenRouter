"use client";

import { useEffect, useState } from "react";
import { onVimModeChange, setActiveVimMode, type VimMode } from "@/lib/editor/vim";
import { cn } from "@/lib/utils/cn";

const MODE_PALETTE: Record<string, { active: string; inactive: string }> = {
  normal: {
    active: "bg-blue-600 text-white border-blue-700",
    inactive: "text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40",
  },
  insert: {
    active: "bg-emerald-600 text-white border-emerald-700",
    inactive: "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40",
  },
  visual: {
    active: "bg-violet-600 text-white border-violet-700",
    inactive: "text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40",
  },
};

const MODES: Array<{ key: VimMode; label: string }> = [
  { key: "normal", label: "N" },
  { key: "insert", label: "I" },
  { key: "visual", label: "V" },
];

/**
 * Toggle pill para alternar entre NORMAL / INSERT / VISUAL cuando el modo
 * vim está activo. Aparece en la cabecera del editor (junto a Ln/Col).
 * Todo el resto del binding vim sigue siendo por teclado físico:
 *   Esc → NORMAL,  i/a/o → INSERT,  v → VISUAL,  h/j/k/l, w/b/e, d/y/p, etc.
 */
export function VimModeToggle() {
  const [mode, setMode] = useState<VimMode>("normal");

  useEffect(() => {
    return onVimModeChange((m) => setMode(m));
  }, []);

  const choose = (next: VimMode) => {
    if (next === mode) return;
    setActiveVimMode(next);
  };

  return (
    <div
      role="group"
      aria-label="Modo Vim"
      className="inline-flex items-center gap-0.5 rounded-full border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
      title="Cambia de modo vim (también: Esc → NORMAL, i → INSERT, v → VISUAL)"
    >
      <span className="px-1.5 text-[10px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
        Vim
      </span>
      {MODES.map((m) => {
        const isActive = m.key === mode;
        const palette = MODE_PALETTE[m.key] ?? MODE_PALETTE.normal!;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => choose(m.key)}
            aria-pressed={isActive}
            className={cn(
              "h-6 min-w-[26px] rounded-full border px-2 text-[11px] font-semibold transition-colors",
              isActive
                ? palette.active
                : `border-transparent ${palette.inactive}`,
            )}
            title={`Cambiar a modo ${m.key.toUpperCase()}`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
