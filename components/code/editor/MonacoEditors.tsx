"use client";
import { useEffect } from "react";
import Editor, { DiffEditor, loader, type OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { useEditorStore } from "@/store/editor-store";
import { useSettingsStore } from "@/store/settings-store";
import { defineZxAIMonacoThemes, monacoThemeName } from "@/lib/editor/monaco-theme";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils/cn";

function useZxAIMonacoTheme() {
  const { resolvedTheme } = useTheme();
  const name = monacoThemeName(resolvedTheme);

  useEffect(() => {
    let active = true;
    const existing = loader.__getMonacoInstance();
    if (existing) {
      defineZxAIMonacoThemes(existing);
      existing.editor.setTheme(name);
      return;
    }

    loader
      .init()
      .then((monaco) => {
        if (!active || !monaco) return;
        defineZxAIMonacoThemes(monaco);
        monaco.editor.setTheme(name);
      })
      .catch((err) => {
        if (err?.type !== "cancelation") {
          console.error("[Monaco] Error loading instance:", err);
        }
      });

    return () => {
      active = false;
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
}: {
  path: string;
  content: string;
  language: string;
  onChange: (v: string) => void;
}) {
  const isMobile = useIsMobile(768);
  const theme = useZxAIMonacoTheme();
  const minimap = useSettingsStore((s) => s.code?.minimap ?? true);
  const wordWrap = useSettingsStore((s) => s.code?.wordWrap ?? false);
  const setSelection = useEditorStore((s) => s.setSelection);
  const save = useEditorStore((s) => s.save);

  const onMount: OnMount = (editor, monaco) => {
    defineZxAIMonacoThemes(monaco);
    monaco.editor.setTheme(theme);
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
