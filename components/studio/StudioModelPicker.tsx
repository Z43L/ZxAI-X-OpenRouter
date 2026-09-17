"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Headphones, Loader2, RefreshCcw, Search, X } from "lucide-react";
import { useModelStore } from "@/store/model-store";
import { useSettingsStore } from "@/store/settings-store";
import { useStudioStore } from "@/store/studio-store";
import { modelOutputModalities } from "@/types/capabilities";
import type { OpenRouterModelItem } from "@/types/openrouter";
import { cn } from "@/lib/utils/cn";
import { hasTools } from "@/lib/utils/pricing";

function labelFor(id: string, models: { id: string; name: string }[]): string {
  if (!id) return "Seleccionar modelo";
  const m = models.find((x) => x.id === id);
  if (!m) return id.split("/").pop() ?? id;
  const last = id.split("/").pop() ?? m.name;
  return m.name.length > 26 ? last : m.name;
}

function isAudioOutput(m: OpenRouterModelItem): boolean {
  return modelOutputModalities(m).some((x) => x.toLowerCase() === "audio");
}

export function StudioModelPicker() {
  const models = useModelStore((s) => s.models);
  const loading = useModelStore((s) => s.loading);
  const loadError = useModelStore((s) => s.loadError);
  const refresh = useModelStore((s) => s.refresh);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const sessions = useStudioStore((s) => s.sessions);
  const activeId = useStudioStore((s) => s.activeSessionId);
  const updateParams = useStudioStore((s) => s.updateParams);
  const newSession = useStudioStore((s) => s.newSession);

  const active = activeId ? sessions.find((s) => s.id === activeId) : null;
  const selected = active?.params.model ?? "";

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => searchRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    if (models.length === 0 && apiKey && !loading && !loadError) {
      void refresh(apiKey);
    }
  }, [models.length, apiKey, loading, loadError, refresh]);

  const audioModels = useMemo(
    () => models.filter(isAudioOutput).sort((a, b) => a.name.localeCompare(b.name)),
    [models],
  );

  // Si llega el catálogo y no hay sesión, creamos una automáticamente para que
  // el picker tenga dónde persistir la selección.
  useEffect(() => {
    if (sessions.length > 0) return;
    if (audioModels.length === 0) return;
    if (!apiKey) return;
    void newSession("Nueva sesión", "manual");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioModels.length, apiKey, sessions.length]);

  // Auto-selección: si hay sesión activa y aún no tiene modelo, elegimos el primero
  // con output de audio del catálogo.
  useEffect(() => {
    if (!active) return;
    if (active.params.model) return;
    if (audioModels.length === 0) return;
    void updateParams({ model: audioModels[0].id });
  }, [active, audioModels, updateParams]);

  // Si el usuario eligió un modelo antes de que existiera sesión, lo aplicamos
  // retroactivamente cuando la sesión aparezca.
  useEffect(() => {
    if (!pendingChoice) return;
    if (!active) return;
    if (active.params.model === pendingChoice) {
      setPendingChoice(null);
      return;
    }
    void updateParams({ model: pendingChoice });
    setPendingChoice(null);
  }, [active, pendingChoice, updateParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return audioModels;
    return audioModels.filter((m) =>
      `${m.id} ${m.name}`.toLowerCase().includes(q),
    );
  }, [audioModels, search]);

  const choose = (id: string) => {
    if (active) {
      void updateParams({ model: id });
    } else {
      // No hay sesión: guardamos la elección y la aplicaremos cuando se cree.
      setPendingChoice(id);
      void newSession("Nueva sesión", "manual");
    }
    setOpen(false);
  };

  const knownInCatalog = audioModels.some((m) => m.id === selected);
  const needsAttention = selected.length > 0 && !knownInCatalog;

  // Lo que se muestra en el trigger: si hay selección, su label; si no, el
  // pendiente (que ya se aplicará al crearse la sesión) o el placeholder.
  const displayId = selected || pendingChoice || "";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700",
          !displayId && "border-2 border-dashed border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-300",
          needsAttention && "border-2 border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
        )}
        title={displayId || "Selecciona un modelo de audio"}
      >
        <Headphones className="h-3.5 w-3.5" />
        <span className="max-w-[180px] truncate">
          {!displayId ? "Selecciona modelo de audio" : labelFor(displayId, models)}
        </span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="fixed inset-x-3 top-14 z-50 mx-auto flex max-h-[70vh] max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:left-0 sm:right-auto sm:top-full sm:mt-2 sm:w-[360px] sm:rounded-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar modelos de audio..."
              className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpiar búsqueda"
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            <span>{filtered.length} modelos con output audio</span>
            <button
              type="button"
              onClick={() => apiKey && void refresh(apiKey)}
              className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              title="Recargar catálogo de modelos de OpenRouter"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
              Recargar
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto px-1 py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-zinc-400">
                {loading
                  ? "Cargando modelos…"
                  : loadError
                    ? `Error cargando catálogo: ${loadError}`
                    : "No hay modelos con output de audio en el catálogo actual de tu cuenta."}
              </p>
            )}
            {filtered.map((m) => {
              const isSelected = m.id === displayId;
              const out = modelOutputModalities(m);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => choose(m.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800",
                    isSelected && "bg-zinc-200/60 dark:bg-zinc-800",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {m.name}
                    </div>
                    <div className="truncate text-[11px] text-zinc-500">{m.id}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-[10px] text-zinc-500">
                    {out.includes("audio") && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        audio
                      </span>
                    )}
                    {hasTools(m) && (
                      <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                        tools
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
