import type { OpenRouterModelItem } from "@/types/openrouter";

export function isFreeModel(m: OpenRouterModelItem): boolean {
  const p = m.pricing;
  if (!p) return false;
  return p.prompt === "0" && p.completion === "0";
}

function inputModalities(m: OpenRouterModelItem): string[] {
  if (m.architecture?.input_modalities) return m.architecture.input_modalities;
  if (m.input_modalities) return m.input_modalities;
  return [];
}

export function hasVision(m: OpenRouterModelItem): boolean {
  const mods = inputModalities(m).map((x) => x.toLowerCase());
  return mods.includes("image") || mods.includes("vision") || mods.includes("file");
}

export function hasTools(m: OpenRouterModelItem): boolean {
  return !!m.supported_parameters?.includes("tools");
}

const REASONING_HINT = /r1|reasoning|qwq|o1|o3|thinking|deepthink|glm-z1|marin/i;

export function hasReasoning(m: OpenRouterModelItem): boolean {
  if (m.supported_parameters?.includes("reasoning")) return true;
  return REASONING_HINT.test(`${m.id} ${m.name}`);
}

export function modelProvider(m: OpenRouterModelItem): string {
  const [provider] = m.id.split("/");
  return provider || "otros";
}

export function shortModelName(m: OpenRouterModelItem): string {
  return m.name || m.id;
}
