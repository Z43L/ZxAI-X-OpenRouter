import type { OpenRouterModelItem } from "./openrouter";

export type ReasoningLevel = "auto" | "off" | "low" | "medium" | "high";
export type WebSearchMode = "auto" | "always";
export type WebSearchDepth = "fast" | "normal" | "deep";

export interface ReasoningSettings {
  level: ReasoningLevel;
}

export interface WebSearchSettings {
  enabled: boolean;
  mode: WebSearchMode;
  maxResults: number;
  depth: WebSearchDepth;
}

export interface CapabilityConfig {
  reasoning: ReasoningSettings;
  webSearch: WebSearchSettings;
}

export interface MessageCapabilities {
  reasoning?: ReasoningLevel;
  webSearch?: boolean;
}

export interface Citation {
  url: string;
  title?: string;
  content?: string;
  startIndex?: number;
  endIndex?: number;
}

export type SearchPhase = "idle" | "searching" | "sources" | "writing";

export type CapabilityId = "web-search" | "reasoning" | "expand";

export interface CapabilityContext {
  model?: OpenRouterModelItem;
}

export interface OpenRouterRequest {
  model: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  stream?: boolean;
  temperature?: number;
  models?: string[];
  reasoning?: Record<string, unknown>;
  tools?: unknown[];
  plugins?: unknown[];
  web_search_options?: Record<string, unknown>;
  max_tool_calls?: number;
}

/** Capacidad de request: la UI registra iconos/label aparte para no acoplar React al resolver. */
export interface CapabilityDefinition {
  id: CapabilityId;
  isAvailable(model: OpenRouterModelItem | undefined): boolean;
  isActive(config: CapabilityConfig): boolean;
  buildRequest(
    request: OpenRouterRequest,
    config: CapabilityConfig,
    ctx: CapabilityContext,
  ): OpenRouterRequest;
}
