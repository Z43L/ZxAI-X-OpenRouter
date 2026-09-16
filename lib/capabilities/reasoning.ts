import type { CapabilityDefinition, OpenRouterRequest, ReasoningLevel } from "@/types/capabilities";
import type { OpenRouterModelItem } from "@/types/openrouter";
import { canDisableReasoning, supportsReasoning } from "./model-support";

const EFFORT_ORDER = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

function nearestEffort(wanted: string, supported?: string[] | null): string {
  if (!supported || supported.length === 0) return wanted;
  if (supported.includes(wanted)) return wanted;
  const wantIdx = EFFORT_ORDER.indexOf(wanted as (typeof EFFORT_ORDER)[number]);
  if (wantIdx < 0) return supported[0] ?? wanted;
  for (let i = wantIdx; i < EFFORT_ORDER.length; i++) {
    if (supported.includes(EFFORT_ORDER[i])) return EFFORT_ORDER[i];
  }
  for (let i = wantIdx; i >= 0; i--) {
    if (supported.includes(EFFORT_ORDER[i])) return EFFORT_ORDER[i];
  }
  return supported[0] ?? wanted;
}

function effortForLevel(level: Exclude<ReasoningLevel, "auto">): string {
  if (level === "off") return "none";
  return level;
}

export function buildReasoningPayload(
  level: ReasoningLevel,
  model?: OpenRouterModelItem,
): Record<string, unknown> | undefined {
  if (level === "auto") return undefined;
  if (!supportsReasoning(model)) return undefined;
  if (level === "off") {
    if (!canDisableReasoning(model)) return undefined;
    return { effort: "none", enabled: false };
  }
  const effort = nearestEffort(effortForLevel(level), model?.reasoning?.supported_efforts);
  return { effort };
}

export function applyReasoning(
  request: OpenRouterRequest,
  config: { reasoning: { level: ReasoningLevel } },
  ctx: { model?: OpenRouterModelItem },
): OpenRouterRequest {
  const payload = buildReasoningPayload(config.reasoning.level, ctx.model);
  if (!payload) return request;
  return { ...request, reasoning: payload };
}

export const reasoningCapability: CapabilityDefinition = {
  id: "reasoning",
  isAvailable: supportsReasoning,
  isActive: (config) => config.reasoning.level !== "auto",
  buildRequest: applyReasoning,
};
