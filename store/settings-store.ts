import { create } from "zustand";
import type { AppSettings } from "@/types/settings";
import type { CapabilityConfig } from "@/types/capabilities";
import { normalizeCapabilities } from "@/lib/capabilities/defaults";
import {
  DEFAULT_SETTINGS,
  clearApiKey,
  getApiKey,
  isApiKeyRemembered,
  loadSettings,
  saveSettings,
  setApiKey,
} from "@/lib/storage/settings";

interface SettingsState extends AppSettings {
  apiKey: string;
  rememberKey: boolean;
  settingsOpen: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setPartial: (p: Partial<AppSettings>) => void;
  setDefaultCapabilities: (p: Partial<CapabilityConfig>) => void;
  setKey: (key: string, remember: boolean) => void;
  clearKey: () => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  ...DEFAULT_SETTINGS,
  apiKey: "",
  rememberKey: true,
  settingsOpen: false,
  hydrated: false,

  hydrate: () =>
    set(() => ({
      ...loadSettings(),
      apiKey: getApiKey(),
      rememberKey: isApiKeyRemembered(),
      hydrated: true,
    })),

  setPartial: (p) =>
    set((s) => {
      const next: AppSettings = {
        temperature: p.temperature ?? s.temperature,
        systemPrompt: p.systemPrompt ?? s.systemPrompt,
        siteTitle: p.siteTitle ?? s.siteTitle,
        siteReferer: p.siteReferer ?? s.siteReferer,
        defaultCapabilities: p.defaultCapabilities ?? s.defaultCapabilities,
        code: p.code ?? s.code,
      };
      saveSettings(next);
      return next;
    }),

  setDefaultCapabilities: (p) =>
    set((s) => {
      const defaultCapabilities = normalizeCapabilities({
        reasoning: { ...s.defaultCapabilities.reasoning, ...p.reasoning },
        webSearch: { ...s.defaultCapabilities.webSearch, ...p.webSearch },
      });
      const next: AppSettings = {
        temperature: s.temperature,
        systemPrompt: s.systemPrompt,
        siteTitle: s.siteTitle,
        siteReferer: s.siteReferer,
        defaultCapabilities,
        code: s.code,
      };
      saveSettings(next);
      return { defaultCapabilities };
    }),

  setKey: (key, remember) => {
    setApiKey(key, remember);
    set({ apiKey: key.trim(), rememberKey: remember });
  },

  clearKey: () => {
    clearApiKey();
    set({ apiKey: "" });
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),
}));
