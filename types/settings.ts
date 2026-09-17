import type { CapabilityConfig } from "./capabilities";
import type { CodeSettings } from "./code";

export interface StudioSettings {
  musicOutputDir: string;
  audioFormat: "wav" | "mp3" | "flac" | "opus";
  autoSave: boolean;
}

export interface AppSettings {
  temperature: number;
  systemPrompt: string;
  siteTitle: string;
  siteReferer: string;
  defaultCapabilities: CapabilityConfig;
  code: CodeSettings;
  studio: StudioSettings;
}
