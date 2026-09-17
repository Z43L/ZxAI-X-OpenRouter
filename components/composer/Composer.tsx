"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useChatStore, selectActiveChat } from "@/store/chat-store";
import { useSendOpts } from "@/hooks/use-send-opts";
import { useSettingsStore } from "@/store/settings-store";
import { useModelStore, selectEffectiveModel } from "@/store/model-store";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cloneCapabilities, DEFAULT_CAPABILITIES } from "@/lib/capabilities/defaults";
import { cn } from "@/lib/utils/cn";
import { ComposerTextarea } from "./ComposerTextarea";
import { ComposerToolbar } from "./ComposerToolbar";
import { CapabilityMenu, type CapabilityMenuView } from "./CapabilityMenu";
import { ExpandedComposer, ExpandToggle } from "./ExpandedComposer";
import { AttachmentPreview } from "./AttachmentPreview";
import { useAttachmentStore } from "@/store/attachment-store";

export function Composer({ draft, onDraftChange }: { draft: string; onDraftChange: (v: string) => void }) {
  const send = useChatStore((s) => s.send);
  const stop = useChatStore((s) => s.stop);
  const generation = useChatStore((s) => s.generation);
  const chat = useChatStore(selectActiveChat);
  const setChatCapabilities = useChatStore((s) => s.setChatCapabilities);
  const sendOpts = useSendOpts();
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const models = useModelStore((s) => s.models);
  const effectiveModel = useModelStore(selectEffectiveModel);
  const setPickerOpen = useModelStore((s) => s.setPickerOpen);
  const isMobile = useIsMobile();

  const [warnedKey, setWarnedKey] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<CapabilityMenuView>("root");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const busy = generation === "streaming" || generation === "submitting" || generation === "stopping";

  const config = chat?.capabilities ?? DEFAULT_CAPABILITIES;
  const modelItem = useMemo(
    () => models.find((m) => m.id === effectiveModel),
    [models, effectiveModel],
  );

  const lineCount = draft.split("\n").length;
  const showExpand = expanded || focused || hovered || lineCount > 1 || draft.length > 90;

  const applyConfig = useCallback(
    (next: typeof config) => {
      if (!chat) return;
      setChatCapabilities(chat.id, cloneCapabilities(next));
    },
    [chat, setChatCapabilities],
  );

  const toggleExpand = useCallback(() => {
    setExpanded((v) => !v);
    setMenuOpen(false);
  }, []);

  const submit = useCallback(() => {
    if (busy || !draft.trim()) return;
    if (hydrated && !apiKey.trim()) {
      setWarnedKey(true);
      setSettingsOpen(true);
      return;
    }
    const text = draft;
    const attachments = useAttachmentStore.getState().attachments;
    onDraftChange("");
    setExpanded(false);
    void send(text, { ...sendOpts, capabilities: config, attachments });
    if (attachments.length > 0) useAttachmentStore.getState().clear();
  }, [apiKey, busy, config, draft, hydrated, onDraftChange, send, sendOpts, setSettingsOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        toggleExpand();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        applyConfig({
          ...config,
          webSearch: { ...config.webSearch, enabled: !config.webSearch.enabled },
        });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [applyConfig, config, toggleExpand]);

  useEffect(() => {
    if (expanded) taRef.current?.focus();
  }, [expanded]);

  const openMenu = (view: CapabilityMenuView = "root") => {
    setPickerOpen(false);
    setMenuView(view);
    setMenuOpen(true);
  };

  const panel = (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "composer-panel relative flex min-h-16 flex-col overflow-visible rounded-[24px] border border-zinc-200/80 bg-zinc-50 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)] transition-[box-shadow,border-color] duration-200 focus-within:border-zinc-300 dark:border-zinc-700/80 dark:bg-zinc-900 dark:focus-within:border-zinc-600",
        expanded && !isMobile && "h-[min(58vh,700px)]",
        expanded && isMobile && "h-full min-h-0",
      )}
    >
      <ExpandToggle expanded={expanded} visible={showExpand} onToggle={toggleExpand} />
      <AttachmentPreview />
      <ComposerTextarea
        ref={taRef}
        value={draft}
        expanded={expanded}
        className={showExpand || expanded ? "pr-10" : undefined}
        onChange={onDraftChange}
        onSubmit={submit}
        submitOnEnter={!expanded}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <div className="relative z-20 shrink-0">
        <ComposerToolbar
          config={config}
          draft={draft}
          busy={busy}
          menuOpen={menuOpen}
          onMenuToggle={() => {
            if (menuOpen) setMenuOpen(false);
            else openMenu("root");
          }}
          onOpenView={(view) => openMenu(view)}
          onChange={applyConfig}
          onSubmit={submit}
          onStop={stop}
          onCloseMenu={() => setMenuOpen(false)}
        />
        <CapabilityMenu
          open={menuOpen}
          view={menuView}
          isMobile={isMobile}
          config={config}
          model={modelItem}
          onClose={() => setMenuOpen(false)}
          onView={setMenuView}
          onChange={applyConfig}
          onExpand={() => setExpanded(true)}
        />
      </div>
    </div>
  );

  const shell = (
    <div className="shrink-0 px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:pb-5">
      <div
        className={cn(
          "mx-auto w-full transition-[max-width] duration-200 ease-out",
          expanded && !isMobile ? "max-w-[min(900px,calc(100vw-40px))]" : "max-w-3xl",
        )}
      >
        {warnedKey && !apiKey.trim() && (
          <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Necesitas una API key de OpenRouter para enviar mensajes.{" "}
            <button type="button" onClick={() => setSettingsOpen(true)} className="font-semibold underline">
              Configurarla
            </button>
          </div>
        )}
        {!(expanded && isMobile) && panel}
        <p className="mt-1.5 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          La IA puede cometer errores. Tus chats se guardan solo en este dispositivo.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {shell}
      {expanded &&
        isMobile &&
        typeof document !== "undefined" &&
        createPortal(
          <ExpandedComposer isMobile onCollapse={() => setExpanded(false)}>
            {panel}
          </ExpandedComposer>,
          document.body,
        )}
    </>
  );
}
