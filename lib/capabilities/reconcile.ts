import type { CapabilityConfig } from "@/types/capabilities";
import type { OpenRouterModelItem } from "@/types/openrouter";
import { cloneCapabilities } from "./defaults";
import { supportsReasoning } from "./model-support";

export interface CapabilityNotice {
  title: string;
  body: string;
}

export interface ReconcileResult {
  config: CapabilityConfig;
  changed: boolean;
  notices: CapabilityNotice[];
}

export function reconcileCapabilities(
  config: CapabilityConfig,
  model: OpenRouterModelItem | undefined,
): ReconcileResult {
  const next = cloneCapabilities(config);
  const notices: CapabilityNotice[] = [];

  if (model && !supportsReasoning(model) && next.reasoning.level !== "auto") {
    next.reasoning.level = "auto";
    notices.push({
      title: "Razonamiento desactivado",
      body: `${model.name || model.id} no permite ajustar el nivel de razonamiento.`,
    });
  }

  return {
    config: next,
    changed: notices.length > 0,
    notices,
  };
}
