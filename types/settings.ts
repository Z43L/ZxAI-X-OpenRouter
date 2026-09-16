import type { CapabilityConfig } from "./capabilities";
import type { CodeSettings } from "./code";

export interface AppSettings {
  temperature: number;
  systemPrompt: string;
  siteTitle: string;
  siteReferer: string;
  defaultCapabilities: CapabilityConfig;
  code: CodeSettings;
}
