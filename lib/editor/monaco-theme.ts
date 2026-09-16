import type { Monaco } from "@monaco-editor/react";

/** Zinc ZxAI: mismo fondo/cromado que el resto de la app, no el #1e1e1e de VS Code. */
const DARK = {
  bg: "#09090b",
  fg: "#f4f4f5",
  muted: "#71717a",
  line: "#52525b",
  border: "#27272a",
  hover: "#18181b",
  select: "#27272a",
  selectFg: "#fafafa",
  match: "#3f3f46",
  accent: "#a1a1aa",
} as const;

const LIGHT = {
  bg: "#ffffff",
  fg: "#18181b",
  muted: "#71717a",
  line: "#a1a1aa",
  border: "#e4e4e7",
  hover: "#f4f4f5",
  select: "#e4e4e7",
  selectFg: "#18181b",
  match: "#d4d4d8",
  accent: "#52525b",
} as const;

type Palette = {
  bg: string;
  fg: string;
  muted: string;
  line: string;
  border: string;
  hover: string;
  select: string;
  selectFg: string;
  match: string;
  accent: string;
};

function chrome(c: Palette): Record<string, string> {
  return {
    "editor.background": c.bg,
    "editor.foreground": c.fg,
    "editorCursor.foreground": c.fg,
    "editor.lineHighlightBackground": c.hover,
    "editor.lineHighlightBorder": "#00000000",
    "editor.selectionBackground": c.select,
    "editor.inactiveSelectionBackground": c.match,
    "editor.selectionHighlightBackground": c.match,
    "editor.wordHighlightBackground": c.match,
    "editor.wordHighlightStrongBackground": c.select,
    "editorLineNumber.foreground": c.line,
    "editorLineNumber.activeForeground": c.accent,
    "editorGutter.background": c.bg,
    "editorIndentGuide.background1": c.border,
    "editorIndentGuide.activeBackground1": c.line,
    "editorWhitespace.foreground": c.border,
    "editorBracketMatch.background": c.match,
    "editorBracketMatch.border": c.line,
    "editorWidget.background": c.hover,
    "editorWidget.foreground": c.fg,
    "editorWidget.border": c.border,
    "editorSuggestWidget.background": c.hover,
    "editorSuggestWidget.border": c.border,
    "editorSuggestWidget.foreground": c.fg,
    "editorSuggestWidget.selectedBackground": c.select,
    "editorSuggestWidget.selectedForeground": c.selectFg,
    "editorHoverWidget.background": c.hover,
    "editorHoverWidget.border": c.border,
    "editorHoverWidget.foreground": c.fg,
    "editor.findMatchBackground": c.select,
    "editor.findMatchHighlightBackground": c.match,
    "editor.findRangeHighlightBackground": c.match,
    "minimap.background": c.bg,
    "minimapSlider.background": "#71717a33",
    "minimapSlider.hoverBackground": "#71717a55",
    "minimapSlider.activeBackground": "#71717a77",
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#71717a44",
    "scrollbarSlider.hoverBackground": "#71717a66",
    "scrollbarSlider.activeBackground": "#71717a88",
    "editorOverviewRuler.border": "#00000000",
    "editorOverviewRuler.background": c.bg,
    "editorGroup.border": c.border,
    "editorGroupHeader.tabsBackground": c.bg,
    "input.background": c.hover,
    "input.foreground": c.fg,
    "input.border": c.border,
    "input.placeholderForeground": c.muted,
    "dropdown.background": c.hover,
    "dropdown.foreground": c.fg,
    "dropdown.border": c.border,
    "list.hoverBackground": c.select,
    "list.activeSelectionBackground": c.select,
    "list.activeSelectionForeground": c.selectFg,
    "list.focusBackground": c.select,
    "list.highlightForeground": c.fg,
    "peekView.border": c.border,
    "peekViewEditor.background": c.bg,
    "peekViewResult.background": c.hover,
    "peekViewTitle.background": c.hover,
    "peekViewTitleLabel.foreground": c.fg,
    "peekViewTitleDescription.foreground": c.muted,
    "focusBorder": "#00000000",
    "widget.shadow": "#00000000",
    "diffEditor.insertedTextBackground": "#14532d33",
    "diffEditor.removedTextBackground": "#7f1d1d33",
    "diffEditor.insertedLineBackground": "#14532d22",
    "diffEditor.removedLineBackground": "#7f1d1d22",
    "diffEditor.border": c.border,
    "diffEditorGutter.insertedLineBackground": c.bg,
    "diffEditorGutter.removedLineBackground": c.bg,
    "editorError.foreground": "#f87171",
    "editorWarning.foreground": "#fbbf24",
    "editorInfo.foreground": "#93c5fd",
  };
}

export function defineZxAIMonacoThemes(monaco: Monaco) {
  monaco.editor.defineTheme("zxai-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: chrome(DARK),
  });
  monaco.editor.defineTheme("zxai-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: chrome(LIGHT),
  });
  // Retrocompatibilidad
  monaco.editor.defineTheme("chatai-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: chrome(DARK),
  });
  monaco.editor.defineTheme("chatai-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: chrome(LIGHT),
  });
}

export function monacoThemeName(resolvedTheme?: string) {
  return resolvedTheme === "light" ? "zxai-light" : "zxai-dark";
}
