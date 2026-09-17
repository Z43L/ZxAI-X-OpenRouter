import type { CapabilityDefinition, OpenRouterRequest, VideoGenSettings } from "@/types/capabilities";

/**
 * Vídeo: el modelo debe decidir si invocar la server tool de generación de vídeo.
 * Activamos la tool `openrouter:video_generation` con parámetros del usuario.
 */
export function applyVideoGen(
  request: OpenRouterRequest,
  config: { videoGen: VideoGenSettings },
): OpenRouterRequest {
  const s = config.videoGen;
  if (!s.enabled) return request;
  return {
    ...request,
    tools: [
      ...(request.tools ?? []),
      {
        type: "openrouter:video_generation",
        parameters: {
          aspect_ratio: s.aspectRatio,
          resolution: s.resolution,
          duration: s.durationSec,
          fps: s.fps,
        },
      },
    ],
  };
}

export const videoGenCapability: CapabilityDefinition = {
  id: "video-gen",
  // El servidor de OpenRouter enrutará al modelo correcto si la tool está activa.
  isAvailable: () => true,
  isActive: (config) => config.videoGen.enabled,
  buildRequest: applyVideoGen,
};
