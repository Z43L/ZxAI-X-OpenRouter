"use client";
import { useEffect, useRef } from "react";
import Editor, { DiffEditor, loader, type OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { useEditorStore } from "@/store/editor-store";
import { useSettingsStore } from "@/store/settings-store";
import { defineZxAIMonacoThemes, monacoThemeName } from "@/lib/editor/monaco-theme";
import { attachVimMode, type VimModeHandle } from "@/lib/editor/vim";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils/cn";
import { ensureMonacoConfigured } from "@/lib/editor/monaco-loader";

function useZxAIMonacoTheme() {
  const { resolvedTheme } = useTheme();
  const name = monacoThemeName(resolvedTheme);

  useEffect(() => {
    let active = true;
    let cancelled = false;

    void (async () => {
      try {
        await ensureMonacoConfigured();
      } catch {
        /* ya logueado */
      }
      if (cancelled || !active) return;

      const existing = loader.__getMonacoInstance();
      if (existing) {
        defineZxAIMonacoThemes(existing);
        existing.editor.setTheme(name);
        return;
      }

      try {
        const monaco = await loader.init();
        if (!active || !monaco || cancelled) return;
        defineZxAIMonacoThemes(monaco);
        monaco.editor.setTheme(name);
      } catch (err) {
        if ((err as { type?: string })?.type !== "cancelation") {
          console.error("[Monaco] Error loading instance:", err);
        }
      }
    })();

    return () => {
      active = false;
      cancelled = true;
    };
  }, [name]);

  return name;
}

const editorOptions = {
  fontSize: 13,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  automaticLayout: true,
  scrollBeyondLastLine: false,
  renderLineHighlight: "line" as const,
  tabSize: 2,
  padding: { top: 12, bottom: 12 },
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  overviewRulerLanes: 0,
  smoothScrolling: true,
  cursorBlinking: "smooth" as const,
};

function MonacoShell({ children }: { children: React.ReactNode }) {
  return <div className={cn("zxai-monaco h-full min-h-0 bg-white dark:bg-zinc-950")}>{children}</div>;
}

export function MonacoFileEditor({
  path,
  content,
  language,
  onChange,
  onReady,
}: {
  path: string;
  content: string;
  language: string;
  onChange: (v: string) => void;
  onReady?: (editor: import("monaco-editor").editor.IStandaloneCodeEditor) => void;
}) {
  const isMobile = useIsMobile(768);
  const theme = useZxAIMonacoTheme();
  const minimap = useSettingsStore((s) => s.code?.minimap ?? true);
  const wordWrap = useSettingsStore((s) => s.code?.wordWrap ?? false);
  const vimEnabled = useSettingsStore((s) => s.code?.vimMode ?? false);
  const setSelection = useEditorStore((s) => s.setSelection);
  const save = useEditorStore((s) => s.save);
  const vimHandleRef = useRef<VimModeHandle | null>(null);

  useEffect(() => {
    return () => {
      vimHandleRef.current?.dispose();
      vimHandleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!vimHandleRef.current) return;
    vimHandleRef.current.dispose();
    vimHandleRef.current = null;
  }, [vimEnabled]);

  const onMount: OnMount = (editor, monaco) => {
    try {
      defineZxAIMonacoThemes(monaco);
      monaco.editor.setTheme(theme);
    } catch (err) {
      console.error("[MonacoEditor] onMount theme setup failed:", err);
    }
    try {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        void save(path);
      });
      editor.onDidChangeCursorSelection((e) => {
        const sel = e.selection;
        setSelection(
          path,
          {
            startLine: sel.startLineNumber,
            startColumn: sel.startColumn,
            endLine: sel.endLineNumber,
            endColumn: sel.endColumn,
          },
          { line: sel.positionLineNumber, column: sel.positionColumn },
        );
      });
    } catch (err) {
      console.error("[MonacoEditor] onMount commands failed:", err);
    }

    if (vimEnabled) {
      // Async: no rompe la app si monaco-vim no carga.
      void (async () => {
        try {
          await ensureMonacoConfigured();
          const handle = await attachVimMode(editor, monaco);
          vimHandleRef.current = handle;
          if (!handle) {
            console.warn("[vim] attachVimMode devolvió null — modo vim inactivo.");
          } else {
            console.info("[vim] modo vim activo.");
          }
        } catch (err) {
          console.error("[vim] error adjuntando monaco-vim:", err);
        }
      })();
    }

    try {
      onReady?.(editor);
    } catch (err) {
      console.error("[MonacoEditor] onReady callback failed:", err);
    }
  };

  return (
    <MonacoShell>
      <Editor
        path={`zxai/${path}`}
        language={language}
        value={content}
        theme={theme}
        onChange={(v) => onChange(v ?? "")}
        beforeMount={defineZxAIMonacoThemes}
        onMount={onMount}
        loading={<div className="h-full bg-white dark:bg-zinc-950" />}
        options={{
          ...editorOptions,
          minimap: { enabled: isMobile ? false : minimap },
          wordWrap: wordWrap || isMobile ? "on" : "off",
        }}
      />
    </MonacoShell>
  );
}

export function MonacoDiff({
  original,
  modified,
  language,
}: {
  original: string;
  modified: string;
  language: string;
}) {
  const isMobile = useIsMobile(768);
  const theme = useZxAIMonacoTheme();
  return (
    <MonacoShell>
      <DiffEditor
        original={original}
        modified={modified}
        language={language}
        theme={theme}
        beforeMount={defineZxAIMonacoThemes}
        loading={<div className="h-full bg-white dark:bg-zinc-950" />}
        options={{
          ...editorOptions,
          readOnly: true,
          renderSideBySide: !isMobile,
          minimap: { enabled: false },
        }}
      />
    </MonacoShell>
  );
}
