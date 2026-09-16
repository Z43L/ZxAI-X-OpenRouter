import { AUTO_MODEL_ID, FREE_ROUTER_ID, type OpenRouterModelItem } from "@/types/openrouter";

export function isRouterModel(id?: string): boolean {
  return id === AUTO_MODEL_ID || id === FREE_ROUTER_ID;
}

export function modelSupportsParam(model: OpenRouterModelItem | undefined, param: string): boolean {
  return !!model?.supported_parameters?.includes(param);
}

export function supportsReasoning(model: OpenRouterModelItem | undefined): boolean {
  if (!model) return true;
  if (isRouterModel(model.id)) return true;
  if (modelSupportsParam(model, "reasoning")) return true;
  if (model.reasoning) return true;
  return false;
}

export function supportsTools(model: OpenRouterModelItem | undefined): boolean {
  if (!model) return false;
  if (isRouterModel(model.id)) return true;
  return modelSupportsParam(model, "tools");
}

export function reasoningIsMandatory(model: OpenRouterModelItem | undefined): boolean {
  return Boolean(model?.reasoning?.mandatory);
}

export function canDisableReasoning(model: OpenRouterModelItem | undefined): boolean {
  if (!supportsReasoning(model)) return false;
  if (reasoningIsMandatory(model)) return false;
  const efforts = model?.reasoning?.supported_efforts;
  if (Array.isArray(efforts) && efforts.length > 0 && !efforts.includes("none")) return false;
  return true;
}
