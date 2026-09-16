"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useEditorStore } from "@/store/editor-store";
import { useSettingsStore } from "@/store/settings-store";
import { useAppStore } from "@/store/app-store";

export function CodeShortcuts() {
  const setCommandOpen = useWorkspaceStore((s) => s.setCommandOpen);
  const setActivity = useWorkspaceStore((s) => s.setActivity);
  const save = useEditorStore((s) => s.save);
  const saveAll = useEditorStore((s) => s.saveAll);
  const setMode = useAppStore((s) => s.setMode);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setActivity("search");
      }
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const w = useEditorStore.getState().current();
        const g = w?.groups.find((x) => x.id === w.activeGroupId);
        if (g?.activePath) void save(g.activePath);
        else void saveAll();
      }
      if (meta && e.key.toLowerCase() === "p" && !e.shiftKey) {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen, setActivity, save, saveAll, setMode]);

  useEffect(() => {
    const onVis = () => {
      const mode = useSettingsStore.getState().code?.autoSave;
      if (mode === "onWindowChange" && document.visibilityState === "hidden") {
        void useEditorStore.getState().saveAll();
      }
    };
    const onBlur = () => {
      const mode = useSettingsStore.getState().code?.autoSave;
      if (mode === "onFocusChange" || mode === "onWindowChange") {
        void useEditorStore.getState().saveAll();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return null;
}
