"use client";

import { useEffect, useRef } from "react";
import type { editor } from "monaco-editor";
import { useEditorStore } from "@/store/editor-store";
import { useCodingAgentStore } from "@/store/coding-agent-store";
import { useSettingsStore } from "@/store/settings-store";
import { languageFromPath } from "@/lib/workspace/language";
import { basename } from "@/lib/workspace/path";
import { EditorTabs } from "./EditorTabs";
import { MonacoDiff, MonacoFileEditor } from "./MonacoEditors";
import { VimModeToggle } from "./VimModeToggle";
import { cn } from "@/lib/utils/cn";

export function EditorArea() {
  const current = useEditorStore((s) => (s.activeWorkspaceId ? s.byWorkspace[s.activeWorkspaceId] : undefined));
  const setContent = useEditorStore((s) => s.setContent);
  const reviewPath = useCodingAgentStore((s) => s.reviewPath);
  const changeSets = useCodingAgentStore((s) => s.changeSets);
  const activeCs = useCodingAgentStore((s) => s.activeChangeSetId);
  const cs = activeCs ? changeSets[activeCs] : undefined;
  const review = reviewPath ? cs?.files.find((f) => f.path === reviewPath) : undefined;

  const vimMode = useSettingsStore((s) => s.code?.vimMode ?? false);
  const lastEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorReady = (e: editor.IStandaloneCodeEditor) => {
    lastEditorRef.current = e;
  };

  // Capturar Esc a nivel window cuando vim está activo y el editor tiene foco:
  // algunos WebViews de Android no propagan Escape al editor tras
  // background/foreground. Garantizamos que siempre vuelve a NORMAL.
  useEffect(() => {
    if (!vimMode) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      const active = document.activeElement;
      const editor = lastEditorRef.current;
      if (!editor) return;
      const isInsideEditor = editor.getDomNode()?.contains(active ?? null);
      if (!isInsideEditor) return;
      ev.preventDefault();
      editor.focus();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [vimMode]);

  if (!current) {
    return <EmptyEditor />;
  }

  const groups = current.split === "single" ? current.groups.slice(0, 1) : current.groups;
  const vertical = current.split !== "horizontal";

  return (
    <div className={cn("relative flex min-h-0 min-w-0 flex-1", vertical ? "flex-row" : "flex-col")}>
      {groups.map((group) => {
        const buf = group.activePath ? current.buffers[group.activePath] : undefined;
        const showDiff = review && group.activePath === review.path;
        return (
          <div key={group.id} className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950">
            <EditorTabs group={group} />
            {showDiff ? (
              <div className="min-h-0 flex-1">
                <MonacoDiff
                  original={review.original ?? ""}
                  modified={review.proposed ?? ""}
                  language={languageFromPath(review.path)}
                />
              </div>
            ) : buf ? (
              <div className="min-h-0 flex-1">
                <MonacoFileEditor
                  path={buf.path}
                  content={buf.content}
                  language={buf.language}
                  onChange={(v) => setContent(buf.path, v)}
                  onReady={handleEditorReady}
                />
              </div>
            ) : (
              <EmptyEditor />
            )}
            {buf && (
              <div className="flex items-center gap-3 border-t border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-400 dark:border-zinc-800">
                <span>{basename(buf.path)}</span>
                <span>Ln {buf.cursor?.line ?? 1}</span>
                <span>Col {buf.cursor?.column ?? 1}</span>
                <span className="ml-auto flex items-center gap-2">
                  {vimMode && <VimModeToggle />}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmptyEditor() {
  return (
    <div className="flex flex-1 items-center justify-center bg-white text-sm text-zinc-400 dark:bg-zinc-950">
      Abre un archivo desde el explorador o pulsa ⌘P
    </div>
  );
}
