import type { CapabilityConfig } from "@/types/capabilities";
import type { OpenRouterModelItem } from "@/types/openrouter";
import type { ChatCompletionParams, ChatPayloadMessage } from "./client";
import { resolveCapabilities } from "@/lib/capabilities/resolver";

export interface BuildChatRequestArgs {
  model: string;
  messages: ChatPayloadMessage[];
  capabilities: CapabilityConfig;
  settings: {
    temperature?: number;
    fallbacks?: string[];
  };
  modelItem?: OpenRouterModelItem;
}

export function buildChatRequest(args: BuildChatRequestArgs): ChatCompletionParams {
  return resolveCapabilities(
    {
      model: args.model,
      messages: args.messages,
      stream: true,
      temperature: args.settings.temperature,
      models: args.settings.fallbacks,
    },
    args.capabilities,
    { model: args.modelItem },
  ) as ChatCompletionParams;
}
