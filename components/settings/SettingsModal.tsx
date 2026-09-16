"use client";

import { useEffect, useState } from "react";
import { KeyRound, Settings2, Trash2, X } from "lucide-react";
import { useSettingsStore } from "@/store/settings-store";
import { buildExport } from "@/lib/storage/settings";
import { useChatStore } from "@/store/chat-store";
import { DEFAULT_CAPABILITIES } from "@/lib/capabilities/defaults";
import { DEFAULT_CODE_SETTINGS } from "@/types/code";

export function SettingsModal() {
  const open = useSettingsStore((s) => s.settingsOpen);
  if (!open) return null;
  return <SettingsForm />;
}

function SettingsForm() {
  const setOpen = useSettingsStore((s) => s.setSettingsOpen);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const rememberKey = useSettingsStore((s) => s.rememberKey);
  const setKey = useSettingsStore((s) => s.setKey);
  const clearKey = useSettingsStore((s) => s.clearKey);
  const temperature = useSettingsStore((s) => s.temperature);
  const systemPrompt = useSettingsStore((s) => s.systemPrompt);
  const siteTitle = useSettingsStore((s) => s.siteTitle);
  const siteReferer = useSettingsStore((s) => s.siteReferer);
  const defaultCapabilities =
    useSettingsStore((s) => s.defaultCapabilities) ?? DEFAULT_CAPABILITIES;
  const code = useSettingsStore((s) => s.code) ?? DEFAULT_CODE_SETTINGS;
  const setPartial = useSettingsStore((s) => s.setPartial);
  const setDefaultCapabilities = useSettingsStore((s) => s.setDefaultCapabilities);
  const chats = useChatStore((s) => s.chats);

  // Se monta solo al abrir el modal: el estado inicial sale de los stores.
  const [draftKey, setDraftKey] = useState(apiKey);
  const [remember, setRemember] = useState(rememberKey);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const saveKey = () => {
    setKey(draftKey, remember);
  };

  const downloadExport = () => {
    const blob = new Blob(
      [
        buildExport(chats, {
          temperature,
          systemPrompt,
          siteTitle,
          siteReferer,
          defaultCapabilities,
          code,
        }),
      ],
      {
        type: "application/json",
      },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zxai-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Ajustes"
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,calc(env(safe-area-inset-bottom,0px)+1rem))] sm:rounded-2xl sm:pb-5 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            <Settings2 className="h-4 w-4" /> Ajustes
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <KeyRound className="h-4 w-4" /> API key de OpenRouter
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Consigue una en{" "}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline">
              openrouter.ai/keys
            </a>
            . La llamada va directa desde tu navegador a OpenRouter.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder="sk-or-v1-..."
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="shrink-0 rounded-lg border border-zinc-300 px-2.5 text-xs font-medium text-zinc-600 dark:border-zinc-600 dark:text-zinc-300"
            >
              {showKey ? "Ocultar" : "Ver"}
            </button>
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="accent-zinc-900 dark:accent-zinc-100"
            />
            Recordar en este dispositivo
            <span className="text-zinc-400">(si no, solo queda en memoria de la sesión)</span>
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={saveKey}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Guardar clave
            </button>
            {apiKey && (
              <button
                type="button"
                onClick={clearKey}
                className="flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-300"
              >
                <Trash2 className="h-3.5 w-3.5" /> Borrar
              </button>
            )}
          </div>
          {apiKey && (
            <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              ● Clave configurada ({rememberKey ? "recordada en el dispositivo" : "solo en esta sesión"})
            </p>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Generación</h3>
          <label className="mt-2 block text-xs text-zinc-600 dark:text-zinc-300">
            Temperatura: {temperature.toFixed(1)}
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setPartial({ temperature: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
          <label className="mt-2 block text-xs text-zinc-600 dark:text-zinc-300">
            System prompt (opcional)
            <textarea
              value={systemPrompt}
              onChange={(e) => setPartial({ systemPrompt: e.target.value })}
              rows={3}
              placeholder="Ej: Responde siempre en español, de forma concisa."
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
        </div>

        <div className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Capacidades por defecto</h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Se copian a cada conversación nueva. Después cada chat las recuerda por separado.
          </p>
          <label className="mt-2 block text-xs text-zinc-600 dark:text-zinc-300">
            Razonamiento
            <select
              value={defaultCapabilities.reasoning.level}
              onChange={(e) =>
                setDefaultCapabilities({
                  reasoning: { level: e.target.value as typeof defaultCapabilities.reasoning.level },
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="auto">Automático</option>
              <option value="off">Desactivado</option>
              <option value="low">Bajo</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
            </select>
          </label>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={defaultCapabilities.webSearch.enabled}
              onChange={(e) =>
                setDefaultCapabilities({
                  webSearch: { ...defaultCapabilities.webSearch, enabled: e.target.checked },
                })
              }
              className="accent-zinc-900 dark:accent-zinc-100"
            />
            Búsqueda web activa en chats nuevos
          </label>
          {defaultCapabilities.webSearch.enabled && (
            <label className="mt-2 block text-xs text-zinc-600 dark:text-zinc-300">
              Modo de búsqueda
              <select
                value={defaultCapabilities.webSearch.mode}
                onChange={(e) =>
                  setDefaultCapabilities({
                    webSearch: {
                      ...defaultCapabilities.webSearch,
                      mode: e.target.value as typeof defaultCapabilities.webSearch.mode,
                    },
                  })
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="auto">Automático (el modelo decide)</option>
                <option value="always">Siempre buscar</option>
              </select>
            </label>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Code — Auto Save</h3>
          <p className="mt-0.5 text-xs text-zinc-500">En workspaces locales escribe el archivo real. En GitHub solo actualiza el buffer hasta el commit.</p>
          <div className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
            {(["afterDelay", "onFocusChange", "onWindowChange", "off"] as const).map((m) => (
              <label key={m} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="autosave"
                  checked={code.autoSave === m}
                  onChange={() => setPartial({ code: { ...code, autoSave: m } })}
                />
                {m === "afterDelay" && "After delay"}
                {m === "onFocusChange" && "On focus change"}
                {m === "onWindowChange" && "On window change"}
                {m === "off" && "Off"}
              </label>
            ))}
          </div>
          {code.autoSave === "afterDelay" && (
            <label className="mt-2 block text-xs text-zinc-600 dark:text-zinc-300">
              Delay: {code.autoSaveDelayMs} ms
              <input
                type="range"
                min={250}
                max={2000}
                step={50}
                value={code.autoSaveDelayMs}
                onChange={(e) => setPartial({ code: { ...code, autoSaveDelayMs: Number(e.target.value) } })}
                className="mt-1 w-full"
              />
            </label>
          )}
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={code.minimap} onChange={(e) => setPartial({ code: { ...code, minimap: e.target.checked } })} />
            Minimap
          </label>
          <label className="mt-1 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={code.wordWrap} onChange={(e) => setPartial({ code: { ...code, wordWrap: e.target.checked } })} />
            Word wrap
          </label>
        </div>

        <div className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Code — Permisos de la IA</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Lectura automática. Ediciones con review. Borrado, commit y PRs siempre piden confirmación.</p>
          <label className="mt-2 block text-xs text-zinc-600 dark:text-zinc-300">
            Editar archivos
            <select
              value={code.aiPermissions.edit}
              onChange={(e) =>
                setPartial({
                  code: { ...code, aiPermissions: { ...code.aiPermissions, edit: e.target.value as "review" | "auto" } },
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            >
              <option value="review">Mostrar diff primero</option>
              <option value="auto">Aplicar automáticamente</option>
            </select>
          </label>
          <label className="mt-2 block text-xs text-zinc-600 dark:text-zinc-300">
            Crear archivos
            <select
              value={code.aiPermissions.create}
              onChange={(e) =>
                setPartial({
                  code: { ...code, aiPermissions: { ...code.aiPermissions, create: e.target.value as "review" | "auto" } },
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            >
              <option value="review">Mostrar diff primero</option>
              <option value="auto">Aplicar automáticamente</option>
            </select>
          </label>
        </div>

        <div className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Se envía como <code>X-OpenRouter-Title</code> y <code>HTTP-Referer</code>.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-xs text-zinc-600 dark:text-zinc-300">
              Título
              <input
                value={siteTitle}
                onChange={(e) => setPartial({ siteTitle: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-600 dark:text-zinc-300">
              Referer
              <input
                value={siteReferer}
                onChange={(e) => setPartial({ siteReferer: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={downloadExport}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-300"
          >
            Exportar chats (JSON, sin API key)
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
