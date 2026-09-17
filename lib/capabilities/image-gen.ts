import type { CapabilityDefinition, ImageGenSettings, OpenRouterRequest } from "@/types/capabilities";
import { modelSupportsModality } from "@/types/capabilities";

export function applyImageGen(
  request: OpenRouterRequest,
  config: { imageGen: ImageGenSettings },
  ctx: { model?: import("@/types/openrouter").OpenRouterModelItem },
): OpenRouterRequest {
  const s = config.imageGen;
  if (!s.enabled) return request;
  const useNative = modelSupportsModality(ctx.model, "image");
  if (useNative) {
    const imageConfig: Record<string, unknown> = {
      aspect_ratio: aspectRatioFromSize(s.size),
      quality: s.quality,
    };
    const modalities = request.modalities ?? ["text"];
    if (!modalities.includes("image")) modalities.push("image");
    return {
      ...request,
      modalities,
      image_config: imageConfig,
    };
  }
  return {
    ...request,
    tools: [
      ...(request.tools ?? []),
      {
        type: "openrouter:image_generation",
        parameters: {
          quality: s.quality,
          size: s.size,
          output_format: s.format,
        },
      },
    ],
  };
}

function aspectRatioFromSize(size: ImageGenSettings["size"]): string {
  if (size === "1024x1792") return "9:16";
  if (size === "1792x1024") return "16:9";
  return "1:1";
}

export const imageGenCapability: CapabilityDefinition = {
  id: "image-gen",
  isAvailable: (model) => modelSupportsModality(model, "image"),
  isActive: (config) => config.imageGen.enabled,
  buildRequest: applyImageGen,
};
