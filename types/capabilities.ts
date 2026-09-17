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

export type ImageSize =
  | "1024x1024"
  | "1024x1792"
  | "1792x1024"
  | "512x512"
  | "auto";
export type ImageQuality = "auto" | "low" | "medium" | "high";

export interface ImageGenSettings {
  enabled: boolean;
  size: ImageSize;
  quality: ImageQuality;
  format: "png" | "jpeg" | "webp";
}

export type VideoAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "21:9";
export type VideoResolution = "480p" | "720p" | "1080p";

export interface VideoGenSettings {
  enabled: boolean;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  durationSec: number;
  fps: 24 | 30 | 60;
}

export type AudioVoice =
  | "alloy"
  | "echo"
  | "fable"
  | "onyx"
  | "nova"
  | "shimmer"
  | "ash"
  | "sage"
  | "coral";

export type AudioFormat = "wav" | "mp3" | "flac" | "opus" | "pcm16";

export interface AudioGenSettings {
  enabled: boolean;
  voice: AudioVoice;
  format: AudioFormat;
  durationSec: number;
}

export interface CapabilityConfig {
  reasoning: ReasoningSettings;
  webSearch: WebSearchSettings;
  imageGen: ImageGenSettings;
  videoGen: VideoGenSettings;
  audioGen: AudioGenSettings;
}

export interface MessageCapabilities {
  reasoning?: ReasoningLevel;
  webSearch?: boolean;
  imageGen?: boolean;
  videoGen?: boolean;
  audioGen?: boolean;
}

export interface Citation {
  url: string;
  title?: string;
  content?: string;
  startIndex?: number;
  endIndex?: number;
}

export type SearchPhase = "idle" | "searching" | "sources" | "writing";

export type CapabilityId = "web-search" | "reasoning" | "expand" | "image-gen" | "video-gen" | "audio-gen";

export interface CapabilityContext {
  model?: OpenRouterModelItem;
}

export interface OpenRouterRequest {
  model: string;
  messages: { role: "user" | "assistant" | "system"; content: string | ContentPart[] }[];
  stream?: boolean;
  temperature?: number;
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

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }
  | { type: "input_audio"; input_audio: { data: string; format: string } }
  | { type: "video_url"; video_url: { url: string; processing?: "agentic" | "static" } }
  | { type: "file"; file: { filename?: string; file_data?: string } };

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

export function modelOutputModalities(model: OpenRouterModelItem | undefined): string[] {
  if (!model) return [];
  const arch = model.architecture?.output_modalities ?? model.output_modalities ?? [];
  return arch.map((m) => m.toLowerCase());
}

export function modelSupportsModality(model: OpenRouterModelItem | undefined, modality: string): boolean {
  const out = modelOutputModalities(model);
  return out.includes(modality.toLowerCase());
}
