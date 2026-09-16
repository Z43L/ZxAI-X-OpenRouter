import type { CapabilityConfig, CapabilityContext, OpenRouterRequest } from "@/types/capabilities";
import { reasoningCapability } from "./reasoning";
import { webSearchCapability } from "./web-search";

/** Capacidades que mutan el request OpenRouter. Las de UI (expand) no entran aquí. */
export const requestCapabilities = [webSearchCapability, reasoningCapability];

export function resolveCapabilities(
  request: OpenRouterRequest,
  config: CapabilityConfig,
  ctx: CapabilityContext,
): OpenRouterRequest {
  let next = request;
  for (const cap of requestCapabilities) {
    next = cap.buildRequest(next, config, ctx);
  }
  return next;
}
