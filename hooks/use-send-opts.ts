"use client";

import { useMemo } from "react";
import { selectEffectiveModel, useModelStore } from "@/store/model-store";
import { useSettingsStore } from "@/store/settings-store";
import { selectActiveChat, useChatStore, type SendOpts } from "@/store/chat-store";
import { DEFAULT_CAPABILITIES } from "@/lib/capabilities/defaults";

/** Construye las opciones de envío desde los stores (settings + modelo + capabilities del chat). */
export function useSendOpts(): SendOpts {
  const apiKey = useSettingsStore((s) => s.apiKey);
  const temperature = useSettingsStore((s) => s.temperature);
  const systemPrompt = useSettingsStore((s) => s.systemPrompt);
  const siteTitle = useSettingsStore((s) => s.siteTitle);
  const siteReferer = useSettingsStore((s) => s.siteReferer);
  const model = useModelStore(selectEffectiveModel);
  const capabilities = useChatStore((s) => selectActiveChat(s)?.capabilities ?? DEFAULT_CAPABILITIES);

  return useMemo(
    () => ({
      model,
      apiKey,
      temperature,
      systemPrompt,
      siteTitle,
      siteReferer,
      capabilities,
    }),
    [model, apiKey, temperature, systemPrompt, siteTitle, siteReferer, capabilities],
  );
}
