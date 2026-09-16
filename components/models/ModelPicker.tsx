"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { selectEffectiveModel, useModelStore } from "@/store/model-store";
import { useSettingsStore } from "@/store/settings-store";
import { AUTO_MODEL_ID } from "@/types/openrouter";
import { cn } from "@/lib/utils/cn";
import { ModelRow } from "./ModelRow";
import { AutoRow, ModelFiltersBar } from "./ModelFilters";

function labelFor(id: string, models: { id: string; name: string }[]): string {
  if (id === AUTO_MODEL_ID) return "Auto";
  const m = models.find((x) => x.id === id);
  if (!m) return id.split("/").pop() ?? id;
  return m.name.length > 28 ? (id.split("/").pop() ?? m.name) : m.name;
}

export function ModelPicker({
  variant = "default",
  align = "start",
  drop = "up",
}: {
  variant?: "default" | "toolbar";
  align?: "start" | "end" | "center";
  drop?: "up" | "down";
}) {
  const models = useModelStore((s) => s.models);
  const loading = useModelStore((s) => s.loading);
  const loadError = useModelStore((s) => s.loadError);
  const selectedModel = useModelStore((s) => s.selectedModel);
  const effectiveModel = useModelStore(selectEffectiveModel);
  const filters = useModelStore((s) => s.filters);
  const pickerOpen = useModelStore((s) => s.pickerOpen);
  const providers = useModelStore((s) => s.providers);
  const filtered = useModelStore((s) => s.filtered);
  const setFilters = useModelStore((s) => s.setFilters);
  const select = useModelStore((s) => s.select);
  const setPickerOpen = useModelStore((s) => s.setPickerOpen);
  const refresh = useModelStore((s) => s.refresh);
  const apiKey = useSettingsStore((s) => s.apiKey);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const list = useMemo(
    () => filtered(),
    // filtered/providers son referencias estables: hay que depender
    // de los valores (models/filters) para recalcular al cargarse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, models, filters],
  );
  const providerList = useMemo(
    () => providers(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [providers, models],
  );

  useEffect(() => {
    if (!pickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    // Foco en búsqueda al abrir (command palette).
    const t = setTimeout(() => searchRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [pickerOpen, setPickerOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setPickerOpen(!pickerOpen)}
        className={cn(
          "flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 font-medium text-zinc-600 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
          variant === "toolbar" ? "max-w-[160px] text-xs sm:max-w-[200px] sm:text-sm" : "max-w-[220px] text-sm sm:max-w-[320px]",
        )}
        title={effectiveModel}
      >
        <span className="truncate">{labelFor(effectiveModel, models)}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>

      {pickerOpen && (
        <div
          className={cn(
            "fixed inset-x-3 z-50 mx-auto flex max-h-[75vh] max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:max-h-[70vh] sm:w-[420px] sm:rounded-xl sm:shadow-xl dark:border-zinc-800 dark:bg-zinc-900",
            drop === "down"
              ? "max-sm:top-14 max-sm:bottom-auto sm:top-full sm:bottom-auto sm:mt-2"
              : "max-sm:bottom-16 max-sm:top-auto sm:bottom-full sm:top-auto sm:mb-2",
            align === "center"
              ? "sm:left-1/2 sm:-translate-x-1/2 sm:right-auto"
              : align === "end"
                ? "sm:right-0 sm:left-auto"
                : "sm:left-0 sm:right-auto",
          )}
        >
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              ref={searchRef}
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              placeholder="Buscar modelos..."
              className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => setFilters({ search: "" })}
                className="text-zinc-400 hover:text-zinc-600"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <ModelFiltersBar tab={filters.tab} onTab={(tab) => setFilters({ tab })} />

          <div className="border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {showAdvanced ? "− Ocultar filtros" : "+ Filtros avanzados"}
            </button>
            {showAdvanced && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 text-xs">
                <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={filters.visionOnly}
                    onChange={(e) => setFilters({ visionOnly: e.target.checked })}
                    className="accent-zinc-900 dark:accent-zinc-100"
                  />
                  Vision
                </label>
                <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={filters.toolsOnly}
                    onChange={(e) => setFilters({ toolsOnly: e.target.checked })}
                    className="accent-zinc-900 dark:accent-zinc-100"
                  />
                  Tools
                </label>
                <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  Contexto mín.
                  <select
                    value={filters.minContext}
                    onChange={(e) => setFilters({ minContext: Number(e.target.value) })}
                    className="rounded border border-zinc-200 bg-transparent px-1 py-0.5 dark:border-zinc-700"
                  >
                    <option value={0}>Cualquiera</option>
                    <option value={32000}>32K+</option>
                    <option value={128000}>128K+</option>
                    <option value={1000000}>1M+</option>
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  Proveedor
                  <select
                    value={filters.provider}
                    onChange={(e) => setFilters({ provider: e.target.value })}
                    className="max-w-[130px] rounded border border-zinc-200 bg-transparent px-1 py-0.5 dark:border-zinc-700"
                  >
                    <option value="all">Todos</option>
                    {providerList.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  Orden
                  <select
                    value={filters.sort}
                    onChange={(e) =>
                      setFilters({ sort: e.target.value as typeof filters.sort })
                    }
                    className="rounded border border-zinc-200 bg-transparent px-1 py-0.5 dark:border-zinc-700"
                  >
                    <option value="recommended">Recomendado</option>
                    <option value="price">Precio</option>
                    <option value="context">Contexto</option>
                    <option value="name">Nombre</option>
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {loading && models.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando modelos...
              </div>
            ) : loadError && models.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm">
                <p className="text-zinc-600 dark:text-zinc-300">{loadError}</p>
                <button
                  type="button"
                  onClick={() => refresh(apiKey || undefined)}
                  className="mt-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <>
                {filters.tab === "all" && !filters.search && (
                  <AutoRow selected={selectedModel === AUTO_MODEL_ID} onSelect={() => select(AUTO_MODEL_ID)} />
                )}
                {list.length === 0 && selectedModel !== AUTO_MODEL_ID ? (
                  <p className="px-3 py-6 text-center text-sm text-zinc-500">
                    Sin resultados para esta combinación de filtros.
                  </p>
                ) : (
                  list.slice(0, 200).map((m) => (
                    <ModelRow
                      key={m.id}
                      model={m}
                      selected={selectedModel === m.id}
                      onSelect={() => select(m.id)}
                    />
                  ))
                )}
                {list.length > 200 && (
                  <p className="px-3 py-2 text-center text-[11px] text-zinc-400">
                    Mostrando 200 de {list.length}. Refina la búsqueda.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-1.5 text-[11px] text-zinc-400 dark:border-zinc-800">
            <span className={cn(filters.tab === "free" && "font-semibold text-emerald-600")}>
              {models.length > 0 ? `${list.length} modelos` : "Modelos OpenRouter"}
            </span>
            {selectedModel !== AUTO_MODEL_ID && (
              <button
                type="button"
                onClick={() => select(AUTO_MODEL_ID)}
                className="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <Check className={cn("h-3 w-3", selectedModel === AUTO_MODEL_ID ? "visible" : "invisible")} />
                Volver a Auto
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
