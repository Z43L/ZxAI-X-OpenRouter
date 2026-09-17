import type { AppSettings, StudioSettings } from "@/types/settings";
import { DEFAULT_CAPABILITIES, normalizeCapabilities } from "@/lib/capabilities/defaults";
import { DEFAULT_CODE_SETTINGS, type CodeSettings } from "@/types/code";

const API_KEY_SESSION = "chatai.apikey.session";
const API_KEY_LOCAL = "chatai.apikey";
const SETTINGS_KEY = "chatai.settings.v1";

const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  musicOutputDir: "",
  audioFormat: "wav",
  autoSave: false,
};

function normalizeCodeSettings(raw?: Partial<CodeSettings> | null): CodeSettings {
  return {
    autoSave:
      raw?.autoSave === "onFocusChange" || raw?.autoSave === "onWindowChange" || raw?.autoSave === "off"
        ? raw.autoSave
        : "afterDelay",
    autoSaveDelayMs: Math.min(5000, Math.max(250, Number(raw?.autoSaveDelayMs) || 750)),
    minimap: raw?.minimap !== false,
    wordWrap: Boolean(raw?.wordWrap),
    aiPermissions: {
      read: "always",
      edit: raw?.aiPermissions?.edit === "auto" ? "auto" : "review",
      create: raw?.aiPermissions?.create === "auto" ? "auto" : "review",
      delete: "ask",
      commit: "ask",
      pr: "ask",
    },
    vimMode: Boolean(raw?.vimMode),
  };
}

function normalizeStudioSettings(raw?: Partial<StudioSettings> | null): StudioSettings {
  const fmt = raw?.audioFormat;
  const validFormat: StudioSettings["audioFormat"] =
    fmt === "mp3" || fmt === "flac" || fmt === "opus" ? fmt : "wav";
  return {
    musicOutputDir: typeof raw?.musicOutputDir === "string" ? raw.musicOutputDir : "",
    audioFormat: validFormat,
    autoSave: Boolean(raw?.autoSave),
  };
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export const DEFAULT_SETTINGS: AppSettings = {
  temperature: 0.7,
  systemPrompt: "",
  siteTitle: "ZxAI",
  siteReferer: typeof window !== "undefined" ? window.location.origin : "",
  defaultCapabilities: DEFAULT_CAPABILITIES,
  code: DEFAULT_CODE_SETTINGS,
  studio: DEFAULT_STUDIO_SETTINGS,
};

function read(key: string, storage: Storage | null): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, storage: Storage | null, value: string | null): void {
  if (!storage) return;
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    /* storage bloqueado: se ignora */
  }
}

/**
 * La API key vive separada de los chats y nunca entra en export/import.
 * - remember=true  -> localStorage (persistente en el dispositivo)
 * - remember=false -> sessionStorage (solo memoria de la pestaña/sesión)
 */
export function getApiKey(): string {
  if (!isBrowser()) return process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ?? "";
  return (
    read(API_KEY_LOCAL, window.localStorage) ??
    read(API_KEY_SESSION, window.sessionStorage) ??
    process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ??
    ""
  );
}

export function isApiKeyRemembered(): boolean {
  if (!isBrowser()) return false;
  return read(API_KEY_LOCAL, window.localStorage) !== null;
}

export function setApiKey(key: string, remember: boolean): void {
  if (!isBrowser()) return;
  const trimmed = key.trim();
  if (remember) {
    write(API_KEY_LOCAL, window.localStorage, trimmed || null);
    write(API_KEY_SESSION, window.sessionStorage, null);
  } else {
    write(API_KEY_LOCAL, window.localStorage, null);
    write(API_KEY_SESSION, window.sessionStorage, trimmed || null);
  }
}

export function clearApiKey(): void {
  if (!isBrowser()) return;
  write(API_KEY_LOCAL, window.localStorage, null);
  write(API_KEY_SESSION, window.sessionStorage, null);
}

export function loadSettings(): AppSettings {
  if (!isBrowser()) return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      defaultCapabilities: normalizeCapabilities({
        ...DEFAULT_SETTINGS.defaultCapabilities,
        ...(parsed.defaultCapabilities ?? {}),
        reasoning: {
          ...DEFAULT_SETTINGS.defaultCapabilities.reasoning,
          ...(parsed.defaultCapabilities?.reasoning ?? {}),
        },
        webSearch: {
          ...DEFAULT_SETTINGS.defaultCapabilities.webSearch,
          ...(parsed.defaultCapabilities?.webSearch ?? {}),
        },
      }),
      code: normalizeCodeSettings(parsed.code),
      studio: normalizeStudioSettings(parsed.studio),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* se ignora */
  }
}

export interface ExportPayload {
  app: "zxai" | "chatai";
  version: 1;
  exportedAt: number;
  chats: unknown;
  settings: AppSettings;
}

export function buildExport(chats: unknown, settings: AppSettings): string {
  const payload: ExportPayload = {
    app: "zxai",
    version: 1,
    exportedAt: Date.now(),
    chats,
    settings,
  };
  return JSON.stringify(payload, null, 2);
}
