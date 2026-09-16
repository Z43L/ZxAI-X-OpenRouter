import { OPENROUTER_BASE, buildGetHeaders, type OpenRouterHeaders } from "./client";
import type { ModelFilters, ModelsResponse, OpenRouterModelItem } from "@/types/openrouter";
import { AUTO_MODEL_ID, FREE_ROUTER_ID } from "@/types/openrouter";
import { isFreeModel } from "@/lib/utils/pricing";

const MODELS_CACHE_MS = 60 * 60 * 1000;

let cache: { at: number; models: OpenRouterModelItem[] } | null = null;
let inflight: Promise<OpenRouterModelItem[]> | null = null;

export function clearModelsCache(): void {
  cache = null;
}

/**
 * Lista de modelos. La API key es opcional: el endpoint responde
 * públicamente hoy, pero la incluimos si existe para no depender
 * de que eso sea un contrato permanente.
 */
export async function fetchModels(headers: OpenRouterHeaders): Promise<OpenRouterModelItem[]> {
  if (cache && Date.now() - cache.at < MODELS_CACHE_MS) return cache.models;
  if (!inflight) {
    inflight = loadModels(headers).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function loadModels(headers: OpenRouterHeaders): Promise<OpenRouterModelItem[]> {
  let res: Response;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20000);
    try {
      res = await fetch(`${OPENROUTER_BASE}/models`, {
        headers: buildGetHeaders(headers),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Timeout cargando modelos de OpenRouter (20s). Revisa tu conexión.");
    }
    throw new Error(`Error de red cargando modelos: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    throw new Error(`No se pudieron cargar los modelos (HTTP ${res.status}).`);
  }
  let json: ModelsResponse;
  try {
    json = (await res.json()) as ModelsResponse;
  } catch {
    throw new Error("Respuesta inválida del endpoint de modelos (JSON corrupto).");
  }
  const models = json.data ?? [];
  if (models.length === 0) {
    throw new Error("OpenRouter devolvió 0 modelos. Reintenta en unos segundos.");
  }
  cache = { at: Date.now(), models };
  return cache.models;
}

function isBatchId(id: string): boolean {
  return id.endsWith(":batch");
}

/** Modelo gratuito usable: router gratis o el primero del catálogo (orden de la API). */
export function pickFreeFallback(models: OpenRouterModelItem[]): string | null {
  if (models.some((m) => m.id === FREE_ROUTER_ID)) return FREE_ROUTER_ID;
  const free = models.find((m) => isFreeModel(m) && !isBatchId(m.id));
  return free?.id ?? null;
}

/** Fallback cuando el id elegido no está (o ya no está) en el catálogo. */
export function pickCatalogFallback(models: OpenRouterModelItem[]): string {
  if (models.some((m) => m.id === AUTO_MODEL_ID)) return AUTO_MODEL_ID;
  const free = pickFreeFallback(models);
  if (free) return free;
  const usable = models.find((m) => m.id && !isBatchId(m.id));
  return usable?.id ?? AUTO_MODEL_ID;
}

export function isKnownModel(id: string, models: OpenRouterModelItem[]): boolean {
  const trimmed = (id ?? "").trim();
  if (!trimmed) return false;
  if (models.length === 0) {
    return trimmed === AUTO_MODEL_ID || trimmed === FREE_ROUTER_ID;
  }
  return models.some((m) => m.id === trimmed);
}

/**
 * Id que se puede enviar a /chat/completions.
 * Si el catálogo ya cargó y el id no existe, se sustituye por un fallback válido.
 */
export function resolveSendableModel(id: string, models: OpenRouterModelItem[]): string {
  const trimmed = (id ?? "").trim();
  if (!trimmed) return pickCatalogFallback(models);
  if (models.length === 0) return trimmed;
  if (models.some((m) => m.id === trimmed)) return trimmed;
  return pickCatalogFallback(models);
}

/**
 * Modelo efectivo: Auto (o router gratis si los filtros lo piden).
 * Un id explícito que ya no está en el catálogo se sustituye.
 */
export function computeEffectiveModel(
  selectedModel: string,
  models: OpenRouterModelItem[],
  filters: Pick<ModelFilters, "tab" | "visionOnly" | "toolsOnly">,
): string {
  const selected = (selectedModel ?? "").trim() || AUTO_MODEL_ID;
  if (selected !== AUTO_MODEL_ID) {
    return resolveSendableModel(selected, models);
  }
  if (filters.tab === "free" || filters.visionOnly || filters.toolsOnly) {
    if (models.some((m) => m.id === FREE_ROUTER_ID)) return FREE_ROUTER_ID;
    return pickFreeFallback(models) ?? resolveSendableModel(AUTO_MODEL_ID, models);
  }
  return resolveSendableModel(AUTO_MODEL_ID, models);
}

/**
 * Alternativas gratuitas para el parámetro `models` de OpenRouter
 * (failover si el primario está en 429 / sin endpoints).
 * Nunca incluye modelos de pago: un fallback silencioso no debe cobrar.
 */
export function pickModelFallbacks(primary: string, models: OpenRouterModelItem[]): string[] {
  const known = new Set(models.map((m) => m.id));
  const primaryIsFree =
    primary === AUTO_MODEL_ID ||
    primary === FREE_ROUTER_ID ||
    primary.endsWith(":free") ||
    models.some((m) => m.id === primary && isFreeModel(m));
  if (!primaryIsFree) return [];

  const out: string[] = [];
  const add = (id: string | null | undefined) => {
    if (!id || id === primary || out.includes(id) || isBatchId(id)) return;
    if (!known.has(id)) return;
    out.push(id);
  };

  add(FREE_ROUTER_ID);
  for (const m of models) {
    if (isFreeModel(m) || m.id.endsWith(":free")) add(m.id);
    if (out.length >= 3) break;
  }
  return out;
}
