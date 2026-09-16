"use client";

import { X } from "lucide-react";
import { useCapabilityStore } from "@/store/capability-store";

export function ToastHost() {
  const toast = useCapabilityStore((s) => s.toast);
  const dismiss = useCapabilityStore((s) => s.dismissToast);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed top-4 right-0 left-0 z-[70] flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-2xl border border-zinc-200 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/90"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{toast.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{toast.body}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          aria-label="Cerrar aviso"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
