"use client";

import { useEffect, useRef } from "react";
import { selectActiveChat, useChatStore } from "@/store/chat-store";
import { selectEffectiveModel, useModelStore } from "@/store/model-store";
import { useCapabilityStore } from "@/store/capability-store";
import { reconcileCapabilities } from "@/lib/capabilities/reconcile";

/** Si el modelo activo no admite una capability, la resetea y avisa. */
export function useCapabilityReconciliation() {
  const chat = useChatStore(selectActiveChat);
  const setChatCapabilities = useChatStore((s) => s.setChatCapabilities);
  const selectedModel = useModelStore(selectEffectiveModel);
  const models = useModelStore((s) => s.models);
  const showToast = useCapabilityStore((s) => s.showToast);
  const lastKey = useRef<string>("");

  useEffect(() => {
    if (!chat) return;
    const model = models.find((m) => m.id === selectedModel);
    const result = reconcileCapabilities(chat.capabilities, model);
    const key = `${chat.id}:${selectedModel}:${chat.capabilities.reasoning.level}`;
    if (!result.changed) {
      lastKey.current = key;
      return;
    }
    if (lastKey.current === `${chat.id}:${selectedModel}:${result.config.reasoning.level}`) return;
    lastKey.current = `${chat.id}:${selectedModel}:${result.config.reasoning.level}`;
    setChatCapabilities(chat.id, result.config);
    for (const notice of result.notices) showToast(notice.title, notice.body);
  }, [chat, models, selectedModel, setChatCapabilities, showToast]);
}
