"use client";

import { ArrowDown } from "lucide-react";

export function ScrollToBottom({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ir al final"
      className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full border border-zinc-200 bg-white p-2 shadow-lg transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
    >
      <ArrowDown className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
    </button>
  );
}
