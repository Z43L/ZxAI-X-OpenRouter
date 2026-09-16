import type { CapabilityDefinition, OpenRouterRequest, WebSearchDepth, WebSearchSettings } from "@/types/capabilities";
import type { OpenRouterModelItem } from "@/types/openrouter";
import { supportsTools } from "./model-support";

export function searchContextSize(depth: WebSearchDepth): "low" | "medium" | "high" {
  if (depth === "fast") return "low";
  if (depth === "deep") return "high";
  return "medium";
}

function webTool(settings: WebSearchSettings) {
  return {
    type: "openrouter:web_search",
    parameters: {
      max_results: settings.maxResults,
      search_context_size: searchContextSize(settings.depth),
    },
  };
}

function webPlugin(settings: WebSearchSettings) {
  return {
    id: "web",
    max_results: settings.maxResults,
  };
}

/**
 * AUTO + tools  → server tool (el modelo decide si busca).
 * AUTO sin tools → plugin web (grounding en cualquier modelo).
 * ALWAYS         → plugin web (una búsqueda por petición).
 */
export function applyWebSearch(
  request: OpenRouterRequest,
  config: { webSearch: WebSearchSettings },
  ctx: { model?: OpenRouterModelItem },
): OpenRouterRequest {
  const settings = config.webSearch;
  if (!settings.enabled) return request;

  const usePlugin = settings.mode === "always" || !supportsTools(ctx.model);
  if (usePlugin) {
    return {
      ...request,
      plugins: [...(request.plugins ?? []), webPlugin(settings)],
      web_search_options: {
        ...(request.web_search_options ?? {}),
        search_context_size: searchContextSize(settings.depth),
      },
    };
  }

  return {
    ...request,
    tools: [...(request.tools ?? []), webTool(settings)],
  };
}

export const webSearchCapability: CapabilityDefinition = {
  id: "web-search",
  isAvailable: () => true,
  isActive: (config) => config.webSearch.enabled,
  buildRequest: applyWebSearch,
};
