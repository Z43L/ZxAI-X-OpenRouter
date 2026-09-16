import type { AgentMode } from "./code";

export type ToolTier = "safe" | "write" | "destructive" | "remote";

export type AgentRunStatus = "idle" | "thinking" | "tool" | "editing" | "error" | "stopped";

export type ChangeSetStatus = "proposed" | "partially-applied" | "applied" | "rejected";

export type FileChangeKind = "modify" | "add" | "delete";

export type FileChangeStatus = "pending" | "accepted" | "rejected" | "applied";

export interface AgentToolSpec {
  name: string;
  description: string;
  tier: ToolTier;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  id: string;
  name: string;
  ok: boolean;
  content: string;
  blocked?: boolean;
  confirmation?: string;
}

export interface AgentActivity {
  id: string;
  kind: "explore" | "read" | "search" | "edit" | "write" | "delete" | "git" | "plan";
  label: string;
  status: "running" | "done" | "error" | "cancelled";
  path?: string;
  detail?: string;
}

export interface AIFileChange {
  path: string;
  kind: FileChangeKind;
  original: string | null;
  proposed: string | null;
  status: FileChangeStatus;
}

export interface AIChangeSet {
  id: string;
  workspaceId: string;
  files: AIFileChange[];
  summary: string;
  status: ChangeSetStatus;
  createdAt: number;
}

export type CodeMessageRole = "user" | "assistant" | "system";

export interface CodeMessage {
  id: string;
  role: CodeMessageRole;
  content: string;
  status: "pending" | "streaming" | "complete" | "stopped" | "error";
  activities?: AgentActivity[];
  changeSetId?: string;
  error?: string;
  createdAt: number;
}

export interface CodeSession {
  workspaceId: string;
  messages: CodeMessage[];
  model: string;
  mode: AgentMode;
  updatedAt: number;
}

export interface ContextChip {
  id: string;
  kind: "file" | "selection" | "workspace" | "git" | "custom";
  label: string;
  path?: string;
}

export interface AgentContextSnapshot {
  workspaceName: string;
  workspaceType: string;
  currentFile?: { path: string; language?: string; content: string };
  selection?: { path: string; text: string; range: string };
  openFiles: string[];
  gitStatus?: string;
  instructions?: string;
  chips: ContextChip[];
}
