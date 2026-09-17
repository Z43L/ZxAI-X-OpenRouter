import type { AudioFormat, AudioVoice, CapabilityConfig, ImageQuality, ImageSize, MessageCapabilities, ReasoningLevel, VideoAspectRatio, VideoResolution } from "@/types/capabilities";

export const DEFAULT_CAPABILITIES: CapabilityConfig = {
  reasoning: { level: "auto" },
  webSearch: {
    enabled: false,
    mode: "auto",
    maxResults: 5,
    depth: "normal",
  },
  imageGen: {
    enabled: false,
    size: "1024x1024",
    quality: "auto",
    format: "png",
  },
  videoGen: {
    enabled: false,
    aspectRatio: "16:9",
    resolution: "720p",
    durationSec: 8,
    fps: 24,
  },
  audioGen: {
    enabled: false,
    voice: "alloy",
    format: "mp3",
    durationSec: 30,
  },
};

function asReasoningLevel(v: unknown): ReasoningLevel | undefined {
  if (v === "auto" || v === "off" || v === "low" || v === "medium" || v === "high") return v;
  return undefined;
}

function asImageSize(v: unknown): ImageSize {
  if (v === "1024x1024" || v === "1024x1792" || v === "1792x1024" || v === "512x512") return v;
  return DEFAULT_CAPABILITIES.imageGen.size;
}

function asImageQuality(v: unknown): ImageQuality {
  if (v === "low" || v === "medium" || v === "high") return v;
  return DEFAULT_CAPABILITIES.imageGen.quality;
}

function asImageFormat(v: unknown): "png" | "jpeg" | "webp" {
  if (v === "jpeg" || v === "webp") return v;
  return "png";
}

function asAspectRatio(v: unknown): VideoAspectRatio {
  if (v === "16:9" || v === "9:16" || v === "1:1" || v === "4:3" || v === "21:9") return v;
  return DEFAULT_CAPABILITIES.videoGen.aspectRatio;
}

function asResolution(v: unknown): VideoResolution {
  if (v === "480p" || v === "720p" || v === "1080p") return v;
  return DEFAULT_CAPABILITIES.videoGen.resolution;
}

function asFps(v: unknown): 24 | 30 | 60 {
  if (v === 24 || v === 30 || v === 60) return v;
  return 24;
}

function asVoice(v: unknown): AudioVoice {
  if (
    v === "alloy" ||
    v === "echo" ||
    v === "fable" ||
    v === "onyx" ||
    v === "nova" ||
    v === "shimmer" ||
    v === "ash" ||
    v === "sage" ||
    v === "coral"
  )
    return v;
  return DEFAULT_CAPABILITIES.audioGen.voice;
}

function asAudioFormat(v: unknown): AudioFormat {
  if (v === "wav" || v === "mp3" || v === "flac" || v === "opus" || v === "pcm16") return v;
  return DEFAULT_CAPABILITIES.audioGen.format;
}

function clampDuration(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function cloneCapabilities(config: CapabilityConfig): CapabilityConfig {
  return {
    reasoning: { level: config.reasoning.level },
    webSearch: { ...config.webSearch },
    imageGen: { ...config.imageGen },
    videoGen: { ...config.videoGen },
    audioGen: { ...config.audioGen },
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
    imageGen: {
      enabled: Boolean(raw?.imageGen?.enabled),
      size: asImageSize(raw?.imageGen?.size),
      quality: asImageQuality(raw?.imageGen?.quality),
      format: asImageFormat(raw?.imageGen?.format),
    },
    videoGen: {
      enabled: Boolean(raw?.videoGen?.enabled),
      aspectRatio: asAspectRatio(raw?.videoGen?.aspectRatio),
      resolution: asResolution(raw?.videoGen?.resolution),
      durationSec: clampDuration(raw?.videoGen?.durationSec, 2, 60, 8),
      fps: asFps(raw?.videoGen?.fps),
    },
    audioGen: {
      enabled: Boolean(raw?.audioGen?.enabled),
      voice: asVoice(raw?.audioGen?.voice),
      format: asAudioFormat(raw?.audioGen?.format),
      durationSec: clampDuration(raw?.audioGen?.durationSec, 5, 120, 30),
    },
  };
}

export function configToSnapshot(config: CapabilityConfig): MessageCapabilities {
  return {
    reasoning: config.reasoning.level,
    webSearch: config.webSearch.enabled,
    imageGen: config.imageGen.enabled,
    videoGen: config.videoGen.enabled,
    audioGen: config.audioGen.enabled,
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
    imageGen: {
      ...fallback.imageGen,
      enabled: snap.imageGen ?? fallback.imageGen.enabled,
    },
    videoGen: {
      ...fallback.videoGen,
      enabled: snap.videoGen ?? fallback.videoGen.enabled,
    },
    audioGen: {
      ...fallback.audioGen,
      enabled: snap.audioGen ?? fallback.audioGen.enabled,
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
