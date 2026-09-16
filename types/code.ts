export type AppMode = "chat" | "code";

export type ActivityView = "explorer" | "search" | "scm" | "ai";

export type AutoSaveMode = "afterDelay" | "onFocusChange" | "onWindowChange" | "off";

export type AgentMode = "ask" | "edit" | "agent";

export type SaveStatus = "saved" | "saving" | "unsaved" | "error" | "readonly";

export interface OpenTab {
  path: string;
  pinned: boolean;
  preview?: boolean;
}

export interface EditorGroup {
  id: string;
  tabs: OpenTab[];
  activePath: string | null;
}

export type SplitLayout = "single" | "vertical" | "horizontal";

export interface EditorBuffer {
  path: string;
  content: string;
  savedContent: string;
  dirty: boolean;
  saving: boolean;
  language: string;
  encoding: "utf-8";
  cursor?: { line: number; column: number };
  selection?: { startLine: number; startColumn: number; endLine: number; endColumn: number };
}

export interface ExplorerClipboard {
  mode: "copy" | "cut";
  paths: string[];
}

export interface CodeSettings {
  autoSave: AutoSaveMode;
  autoSaveDelayMs: number;
  minimap: boolean;
  wordWrap: boolean;
  aiPermissions: AiPermissionConfig;
}

export interface AiPermissionConfig {
  read: "always";
  edit: "review" | "auto";
  create: "review" | "auto";
  delete: "ask";
  commit: "ask";
  pr: "ask";
}

export const DEFAULT_CODE_SETTINGS: CodeSettings = {
  autoSave: "afterDelay",
  autoSaveDelayMs: 750,
  minimap: true,
  wordWrap: false,
  aiPermissions: {
    read: "always",
    edit: "review",
    create: "review",
    delete: "ask",
    commit: "ask",
    pr: "ask",
  },
};
