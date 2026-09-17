import { create } from "zustand";
import type { AppSettings, StudioSettings } from "@/types/settings";
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
  setStudio: (p: Partial<StudioSettings>) => void;
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
        studio: p.studio ?? s.studio,
      };
      saveSettings(next);
      return next;
    }),

  setStudio: (p) =>
    set((s) => {
      const studio: StudioSettings = {
        musicOutputDir: p.musicOutputDir ?? s.studio.musicOutputDir,
        audioFormat: p.audioFormat ?? s.studio.audioFormat,
        autoSave: p.autoSave ?? s.studio.autoSave,
      };
      const next: AppSettings = {
        temperature: s.temperature,
        systemPrompt: s.systemPrompt,
        siteTitle: s.siteTitle,
        siteReferer: s.siteReferer,
        defaultCapabilities: s.defaultCapabilities,
        code: s.code,
        studio,
      };
      saveSettings(next);
      return { studio };
    }),

  setDefaultCapabilities: (p) =>
    set((s) => {
      const defaultCapabilities = normalizeCapabilities({
        reasoning: { ...s.defaultCapabilities.reasoning, ...p.reasoning },
        webSearch: { ...s.defaultCapabilities.webSearch, ...p.webSearch },
        imageGen: { ...s.defaultCapabilities.imageGen, ...p.imageGen },
        videoGen: { ...s.defaultCapabilities.videoGen, ...p.videoGen },
        audioGen: { ...s.defaultCapabilities.audioGen, ...p.audioGen },
      });
      const next: AppSettings = {
        temperature: s.temperature,
        systemPrompt: s.systemPrompt,
        siteTitle: s.siteTitle,
        siteReferer: s.siteReferer,
        defaultCapabilities,
        code: s.code,
        studio: s.studio,
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
