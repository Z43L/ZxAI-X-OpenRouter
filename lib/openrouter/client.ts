export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export interface OpenRouterHeaders {
  apiKey?: string;
  siteReferer?: string;
  siteTitle?: string;
}

export function buildHeaders(opts: OpenRouterHeaders): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.apiKey) headers["Authorization"] = `Bearer ${opts.apiKey}`;
  if (opts.siteReferer) headers["HTTP-Referer"] = opts.siteReferer;
  if (opts.siteTitle) {
    headers["X-Title"] = opts.siteTitle;
    headers["X-OpenRouter-Title"] = opts.siteTitle;
  }
  return headers;
}

/**
 * Headers para GET (p. ej. /models): sin Content-Type para evitar
 * preflight CORS innecesario en el navegador.
 */
export function buildGetHeaders(opts: OpenRouterHeaders): Record<string, string> {
  const headers: Record<string, string> = {};
  if (opts.apiKey) headers["Authorization"] = `Bearer ${opts.apiKey}`;
  if (opts.siteReferer) headers["HTTP-Referer"] = opts.siteReferer;
  if (opts.siteTitle) {
    headers["X-Title"] = opts.siteTitle;
    headers["X-OpenRouter-Title"] = opts.siteTitle;
  }
  return headers;
}

export interface ChatPayloadMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatPayloadMessage[];
  stream?: boolean;
  temperature?: number;
  /** Fallbacks de OpenRouter si el modelo primario falla (429, sin endpoints, etc.). */
  models?: string[];
  reasoning?: Record<string, unknown>;
  tools?: unknown[];
  plugins?: unknown[];
  web_search_options?: Record<string, unknown>;
  max_tool_calls?: number;
  modalities?: string[];
  audio?: Record<string, unknown>;
  image_config?: Record<string, unknown>;
}

export function buildChatBody(params: ChatCompletionParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    stream: params.stream ?? true,
  };
  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.models && params.models.length > 0) body.models = params.models;
  if (params.reasoning) body.reasoning = params.reasoning;
  if (params.tools && params.tools.length > 0) body.tools = params.tools;
  if (params.plugins && params.plugins.length > 0) body.plugins = params.plugins;
  if (params.web_search_options) body.web_search_options = params.web_search_options;
  if (params.max_tool_calls !== undefined) body.max_tool_calls = params.max_tool_calls;
  if (params.modalities && params.modalities.length > 0) body.modalities = params.modalities;
  if (params.audio) body.audio = params.audio;
  if (params.image_config) body.image_config = params.image_config;
  return body;
}
