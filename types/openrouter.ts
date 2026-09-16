export interface ModelPricing {
  prompt: string;
  completion: string;
  request?: string;
  image?: string;
  audio?: string;
  discount?: number;
}

export interface ModelArchitecture {
  modality?: string;
  input_modalities?: string[];
  output_modalities?: string[];
  tokenizer?: string;
}

export interface ModelReasoningInfo {
  supported_efforts?: string[] | null;
  default_effort?: string;
  default_enabled?: boolean;
  mandatory?: boolean;
  supports_max_tokens?: boolean;
}

/** Item tal cual lo devuelve GET /api/v1/models (campos que usamos). */
export interface OpenRouterModelItem {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: ModelPricing;
  supported_parameters?: string[] | null;
  reasoning?: ModelReasoningInfo;
  /** Forma nueva de la API. */
  architecture?: ModelArchitecture;
  /** Forma antigua / alternativa. */
  input_modalities?: string[];
  output_modalities?: string[];
  created?: number;
}

export interface ModelsResponse {
  data: OpenRouterModelItem[];
}

export type ModelTab = "all" | "free" | "fast" | "reasoning";
export type ModelSort = "recommended" | "price" | "context" | "name";

export interface ModelFilters {
  tab: ModelTab;
  search: string;
  visionOnly: boolean;
  toolsOnly: boolean;
  minContext: number;
  provider: string;
  sort: ModelSort;
}

export const AUTO_MODEL_ID = "openrouter/auto";
export const FREE_ROUTER_ID = "openrouter/free";
export const AUTO_MODEL_LABEL = "Auto";
