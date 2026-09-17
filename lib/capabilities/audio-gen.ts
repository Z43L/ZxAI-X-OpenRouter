import type { AudioGenSettings, CapabilityDefinition, OpenRouterRequest } from "@/types/capabilities";
import { modelSupportsModality } from "@/types/capabilities";
import type { OpenRouterModelItem } from "@/types/openrouter";

/**
 * Audio nativo: el modelo decodifica a audio en streaming
 * vía `modalities: ["text","audio"]` + `audio: {voice, format}`.
 *
 * Si el modelo no soporta audio output (no listado en output_modalities),
 * activamos la server tool `openrouter:audio_generation` como fallback.
 */
export function applyAudioGen(
  request: OpenRouterRequest,
  config: { audioGen: AudioGenSettings },
  ctx: { model?: OpenRouterModelItem },
): OpenRouterRequest {
  const s = config.audioGen;
  if (!s.enabled) return request;
  if (modelSupportsModality(ctx.model, "audio")) {
    const modalities = request.modalities ?? ["text"];
    if (!modalities.includes("audio")) modalities.push("audio");
    return {
      ...request,
      modalities,
      audio: {
        voice: s.voice,
        format: s.format,
      },
    };
  }
  return {
    ...request,
    tools: [
      ...(request.tools ?? []),
      {
        type: "openrouter:audio_generation",
        parameters: {
          voice: s.voice,
          format: s.format,
          duration: s.durationSec,
        },
      },
    ],
  };
}

export const audioGenCapability: CapabilityDefinition = {
  id: "audio-gen",
  isAvailable: (model) => modelSupportsModality(model, "audio"),
  isActive: (config) => config.audioGen.enabled,
  buildRequest: applyAudioGen,
};
