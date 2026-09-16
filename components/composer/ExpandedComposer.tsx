"use client";

import { Maximize2, Minimize2 } from "lucide-react";

export function ExpandedComposer({
  isMobile,
  onCollapse,
  children,
}: {
  isMobile: boolean;
  onCollapse: () => void;
  children: React.ReactNode;
}) {
  if (!isMobile) return <>{children}</>;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950"
      style={{
        height: "100dvh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={onCollapse}
          className="rounded-lg px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancelar
        </button>
        <span className="text-sm font-medium text-zinc-500">Editor</span>
        <button
          type="button"
          onClick={onCollapse}
          className="rounded-lg px-2 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Listo
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-3">{children}</div>
    </div>
  );
}

export function ExpandToggle({
  expanded,
  visible,
  onToggle,
}: {
  expanded: boolean;
  visible: boolean;
  onToggle: () => void;
}) {
  if (!visible && !expanded) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      title={expanded ? "Contraer editor" : "Expandir editor"}
      className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      <Minimize2 className={expanded ? "h-3.5 w-3.5" : "hidden h-3.5 w-3.5"} />
      <Maximize2 className={expanded ? "hidden h-3.5 w-3.5" : "h-3.5 w-3.5"} />
    </button>
  );
}
