export type StudioMode = "manual" | "agent";

export interface StudioParams {
  prompt: string;
  bpm?: number;
  key?: string;
  mood?: string;
  instruments?: string[];
  durationSec?: number;
  model: string;
  audio: {
    voice?: string;
    format: "wav" | "mp3" | "flac" | "opus";
  };
  agentInterval: number;
}

export interface StudioClip {
  id: string;
  index: number;
  prompt: string;
  transcript: string;
  dataUrl: string;
  format: string;
  bytes: number;
  model: string;
  params: StudioParams;
  createdAt: number;
  savedTo?: string;
}

export interface StudioMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  params?: Partial<StudioParams>;
  clipId?: string;
  createdAt: number;
}

export interface StudioSession {
  id: string;
  name: string;
  mode: StudioMode;
  params: StudioParams;
  clips: StudioClip[];
  messages: StudioMessage[];
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_STUDIO_PARAMS: StudioParams = {
  prompt: "",
  bpm: 90,
  key: "C",
  mood: "relaxed",
  instruments: [],
  durationSec: 30,
  /** Se completa automáticamente con el primer modelo de audio del catálogo. */
  model: "",
  audio: { format: "wav" },
  agentInterval: 3,
};

/** Selector: id del primer modelo del catálogo con output de audio (modality="audio"). */
export function pickStudioFallbackModel(
  models: { id: string; architecture?: { output_modalities?: string[] } | null }[],
): string | null {
  for (const m of models) {
    const out = m.architecture?.output_modalities ?? [];
    if (out.some((x) => x.toLowerCase() === "audio")) return m.id;
  }
  return null;
}
