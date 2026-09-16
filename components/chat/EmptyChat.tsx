"use client";

import { MessageSquarePlus, Code2 } from "lucide-react";
import { useAppStore } from "@/store/app-store";

export function EmptyChat({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  const setMode = useAppStore((s) => s.setMode);
  const suggestions = [
    "Explícame un concepto complejo de forma sencilla",
    "Escríbeme una función en TypeScript",
    "Dame ideas para un proyecto",
    "Ayúdame a redactar un correo profesional",
  ];
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800">
        <MessageSquarePlus className="h-8 w-8 text-zinc-500 dark:text-zinc-300" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        ¿En qué puedo ayudarte?
      </h2>
      <p className="mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        Escribe abajo para empezar, o abre el modo Code para trabajar sobre un proyecto.
      </p>
      <button
        type="button"
        onClick={() => setMode("code")}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <Code2 className="h-3.5 w-3.5" /> Open in Code
      </button>
      <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className="rounded-xl border border-zinc-200 px-3 py-2.5 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
