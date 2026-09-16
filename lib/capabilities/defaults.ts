import type { CapabilityConfig, MessageCapabilities, ReasoningLevel } from "@/types/capabilities";

export const DEFAULT_CAPABILITIES: CapabilityConfig = {
  reasoning: { level: "auto" },
  webSearch: {
    enabled: false,
    mode: "auto",
    maxResults: 5,
    depth: "normal",
  },
};

function asReasoningLevel(v: unknown): ReasoningLevel | undefined {
  if (v === "auto" || v === "off" || v === "low" || v === "medium" || v === "high") return v;
  return undefined;
}

export function cloneCapabilities(config: CapabilityConfig): CapabilityConfig {
  return {
    reasoning: { level: config.reasoning.level },
    webSearch: { ...config.webSearch },
  };
}

export function normalizeCapabilities(raw?: Partial<CapabilityConfig> | null): CapabilityConfig {
  const reasoningLevel = asReasoningLevel(raw?.reasoning?.level) ?? DEFAULT_CAPABILITIES.reasoning.level;
  const maxResults = Number(raw?.webSearch?.maxResults);
  const depth = raw?.webSearch?.depth;
  return {
    reasoning: { level: reasoningLevel },
    webSearch: {
      enabled: Boolean(raw?.webSearch?.enabled),
      mode: raw?.webSearch?.mode === "always" ? "always" : "auto",
      maxResults: maxResults === 3 || maxResults === 10 ? maxResults : 5,
      depth: depth === "fast" || depth === "deep" ? depth : "normal",
    },
  };
}

export function configToSnapshot(config: CapabilityConfig): MessageCapabilities {
  return {
    reasoning: config.reasoning.level,
    webSearch: config.webSearch.enabled,
  };
}

export function snapshotToConfig(
  snap: MessageCapabilities | undefined,
  fallback: CapabilityConfig,
): CapabilityConfig {
  if (!snap) return cloneCapabilities(fallback);
  return {
    reasoning: {
      level: asReasoningLevel(snap.reasoning) ?? fallback.reasoning.level,
    },
    webSearch: {
      ...fallback.webSearch,
      enabled: snap.webSearch ?? fallback.webSearch.enabled,
    },
  };
}

export function reasoningChipLabel(level: ReasoningLevel): string | null {
  switch (level) {
    case "low":
      return "Bajo";
    case "medium":
      return "Medio";
    case "high":
      return "Alto";
    case "off":
      return "Off";
    default:
      return null;
  }
}

export function reasoningMenuLabel(level: ReasoningLevel): string {
  switch (level) {
    case "auto":
      return "Automático";
    case "off":
      return "Desactivado";
    case "low":
      return "Bajo";
    case "medium":
      return "Medio";
    case "high":
      return "Alto";
  }
}
