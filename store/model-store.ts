import { create } from "zustand";
import type { ModelFilters, OpenRouterModelItem } from "@/types/openrouter";
import { AUTO_MODEL_ID } from "@/types/openrouter";
import {
  computeEffectiveModel,
  fetchModels,
  resolveSendableModel,
} from "@/lib/openrouter/models";
import { hasReasoning, hasTools, hasVision, isFreeModel, modelProvider } from "@/lib/utils/pricing";

const MODEL_KEY = "chatai.model.v1";
const FILTERS_KEY = "chatai.modelfilters.v1";

export interface ModelState {
  models: OpenRouterModelItem[];
  loading: boolean;
  loadError: string | null;
  selectedModel: string;
  filters: ModelFilters;
  pickerOpen: boolean;
  hydrated: boolean;
  hydrate: (apiKey?: string) => void;
  refresh: (apiKey?: string) => Promise<void>;
  select: (id: string) => void;
  setFilters: (p: Partial<ModelFilters>) => void;
  setPickerOpen: (open: boolean) => void;
  filtered: () => OpenRouterModelItem[];
  providers: () => string[];
  effectiveModel: () => string;
}

const DEFAULT_FILTERS: ModelFilters = {
  tab: "all",
  search: "",
  visionOnly: false,
  toolsOnly: false,
  minContext: 0,
  provider: "all",
  sort: "recommended",
};

function readLocal(key: string): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export const useModelStore = create<ModelState>()((set, get) => ({
  models: [],
  loading: false,
  loadError: null,
  selectedModel: AUTO_MODEL_ID,
  filters: DEFAULT_FILTERS,
  pickerOpen: false,
  hydrated: false,

  hydrate: (apiKey) => {
    const saved = readLocal(MODEL_KEY);
    let savedFilters: Partial<ModelFilters> | null = null;
    try {
      const rawFilters = readLocal(FILTERS_KEY);
      savedFilters = rawFilters ? (JSON.parse(rawFilters) as Partial<ModelFilters>) : null;
    } catch {
      savedFilters = null;
    }
    set({
      // Validar que el modelo guardado sea el default o exista en la lista
      // conocida; si es un ID huérfano se conserva igual pero se registra.
      selectedModel: saved || AUTO_MODEL_ID,
      filters: savedFilters ? { ...DEFAULT_FILTERS, ...savedFilters } : DEFAULT_FILTERS,
      hydrated: true,
    });
    void get().refresh(apiKey);
  },

  refresh: async (apiKey) => {
    set({ loading: true, loadError: null });
    try {
      const models = await fetchModels({ apiKey });
      const selected = get().selectedModel;
      const resolved = resolveSendableModel(selected, models);
      if (resolved !== selected) {
        try {
          window.localStorage.setItem(MODEL_KEY, resolved);
        } catch {
          /* se ignora */
        }
      }
      set({ models, loading: false, selectedModel: resolved, loadError: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error cargando modelos.";
      console.error("[ModelStore] fetchModels falló:", message);
      set({
        loading: false,
        loadError: message,
      });
    }
  },

  select: (id) => {
    set({ selectedModel: id, pickerOpen: false });
    try {
      window.localStorage.setItem(MODEL_KEY, id);
    } catch {
      /* se ignora */
    }
  },

  setFilters: (p) => {
    const filters = { ...get().filters, ...p };
    set({ filters });
    try {
      window.localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    } catch {
      /* se ignora */
    }
  },

  setPickerOpen: (open) => set({ pickerOpen: open }),

  filtered: () => {
    const { models, filters } = get();
    const q = filters.search.trim().toLowerCase();
    let list = models.filter((m) => {
      if (filters.tab === "free" && !isFreeModel(m)) return false;
      if (filters.tab === "reasoning" && !hasReasoning(m)) return false;
      // "fast": heurística sin tabla propia — gratis o de bajo coste.
      if (filters.tab === "fast") {
        const price = Number(m.pricing?.prompt ?? NaN);
        if (!Number.isNaN(price) && price > 0.0000005) return false;
      }
      if (filters.visionOnly && !hasVision(m)) return false;
      if (filters.toolsOnly && !hasTools(m)) return false;
      if (filters.minContext > 0 && (m.context_length ?? 0) < filters.minContext) return false;
      if (filters.provider !== "all" && modelProvider(m) !== filters.provider) return false;
      if (q && !`${m.id} ${m.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
    switch (filters.sort) {
      case "price":
        list = [...list].sort(
          (a, b) => Number(a.pricing?.prompt ?? 0) - Number(b.pricing?.prompt ?? 0),
        );
        break;
      case "context":
        list = [...list].sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0));
        break;
      case "name":
        list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break; // orden de la API = recomendado
    }
    return list;
  },

  providers: () => {
    const setP = new Set(get().models.map(modelProvider));
    return [...setP].sort();
  },

  effectiveModel: () => {
    const { selectedModel, models, filters } = get();
    return computeEffectiveModel(selectedModel, models, filters);
  },
}));

/** Selector Zustand: se suscribe a selected/models/filters, no a la fn del store. */
export function selectEffectiveModel(s: Pick<ModelState, "selectedModel" | "models" | "filters">): string {
  return computeEffectiveModel(s.selectedModel, s.models, s.filters);
}
