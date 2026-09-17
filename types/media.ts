export type MediaKind = "image" | "audio" | "video";

export interface GeneratedMedia {
  kind: MediaKind;
  url?: string;
  dataUrl?: string;
  format?: string;
  mimeType?: string;
  bytes?: number;
  transcript?: string;
  prompt?: string;
  model?: string;
  createdAt: number;
}

export interface MessageImage {
  url?: string;
  dataUrl?: string;
  format?: string;
  bytes?: number;
}

export interface MessageAudio {
  url?: string;
  dataUrl?: string;
  format: string;
  bytes?: number;
  transcript?: string;
}

export interface MessageVideo {
  url?: string;
  dataUrl?: string;
  format?: string;
  bytes?: number;
}

export const MEDIA_LIMITS = {
  maxInlineBytes: 25 * 1024 * 1024,
  videoPollIntervalMs: 3_000,
  videoMaxWaitMs: 5 * 60 * 1000,
} as const;
