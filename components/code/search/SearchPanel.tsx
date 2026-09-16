"use client";

import { useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { getProvider } from "@/lib/workspace/registry";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { SearchResult } from "@/types/workspace";

export function SearchPanel() {
  const current = useEditorStore((s) => (s.activeWorkspaceId ? s.byWorkspace[s.activeWorkspaceId] : undefined));
  const setSearch = useEditorStore((s) => s.setSearch);
  const openFile = useEditorStore((s) => s.openFile);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const q = current?.searchQuery.trim() ?? "";
    if (!q) return;
    const provider = getProvider(useWorkspaceStore.getState().activeId);
    if (!provider) return;
    setBusy(true);
    try {
      const found = await provider.search({
        text: q,
        regex: current?.searchRegex,
        caseSensitive: current?.searchCase,
        wholeWord: current?.searchWord,
        include: current?.searchInclude || undefined,
        exclude: current?.searchExclude || undefined,
      });
      setResults(found);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Search</p>
        <input
          value={current?.searchQuery ?? ""}
          onChange={(e) => setSearch({ searchQuery: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && void run()}
          placeholder="Buscar en el workspace"
          className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950"
        />
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={current?.searchCase} onChange={(e) => setSearch({ searchCase: e.target.checked })} />
            Aa
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={current?.searchWord} onChange={(e) => setSearch({ searchWord: e.target.checked })} />
            Palabra
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={current?.searchRegex} onChange={(e) => setSearch({ searchRegex: e.target.checked })} />
            .*
          </label>
        </div>
        <input
          value={current?.searchInclude ?? ""}
          onChange={(e) => setSearch({ searchInclude: e.target.value })}
          placeholder="incluir: src/**/*.ts"
          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          value={current?.searchExclude ?? ""}
          onChange={(e) => setSearch({ searchExclude: e.target.value })}
          placeholder="excluir: dist/**"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="button"
          onClick={() => void run()}
          className="mt-2 w-full rounded-lg bg-zinc-900 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Buscando…" : "Buscar"}
        </button>
      </div>
      <div className="flex-1 overflow-auto p-2 text-xs">
        {results.map((r) => (
          <div key={r.path} className="mb-3">
            <button type="button" className="font-medium text-zinc-800 dark:text-zinc-100" onClick={() => void openFile(r.path)}>
              {r.path} <span className="text-zinc-400">{r.matches.length}</span>
            </button>
            {r.matches.map((m, i) => (
              <button
                type="button"
                key={i}
                onClick={() => void openFile(r.path)}
                className="block w-full truncate py-0.5 text-left text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                L{m.line}: {m.text.trim()}
              </button>
            ))}
          </div>
        ))}
        {!busy && results.length === 0 && current?.searchQuery && (
          <p className="text-zinc-400">Sin resultados.</p>
        )}
      </div>
    </div>
  );
}
