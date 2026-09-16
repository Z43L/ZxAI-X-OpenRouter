import type { AgentToolSpec } from "@/types/agent";
import type { AgentMode } from "@/types/code";

export const AGENT_TOOLS: AgentToolSpec[] = [
  {
    name: "read_file",
    description: "Read a file from the active workspace. Use relative paths from the workspace root.",
    tier: "safe",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Relative file path" } },
      required: ["path"],
    },
  },
  {
    name: "list_directory",
    description: "List files and folders in a directory. Use empty string for the workspace root.",
    tier: "safe",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Relative directory path" } },
      required: ["path"],
    },
  },
  {
    name: "search_files",
    description: "Find files by glob-like name pattern (e.g. **/*auth*.ts).",
    tier: "safe",
    parameters: {
      type: "object",
      properties: { pattern: { type: "string" } },
      required: ["pattern"],
    },
  },
  {
    name: "search_text",
    description: "Search file contents in the workspace. Prefer this over reading the whole project.",
    tier: "safe",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        regex: { type: "boolean" },
        include: { type: "string", description: "Optional glob include, e.g. src/**/*.ts" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_open_files",
    description: "List files currently open in the editor.",
    tier: "safe",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_current_file",
    description: "Get the active file path, language and contents.",
    tier: "safe",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_selection",
    description: "Get the currently selected code in the editor, if any.",
    tier: "safe",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_file_symbols",
    description: "Extract a lightweight outline (functions, classes, exports) from a source file.",
    tier: "safe",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "get_diff",
    description: "Get uncommitted / unsaved workspace changes.",
    tier: "safe",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "write_file",
    description: "Write the full contents of an existing file. Prefer apply_patch for small edits.",
    tier: "write",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "create_file",
    description: "Create a new file with the given contents.",
    tier: "write",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "apply_patch",
    description: "Apply a unified diff patch to an existing file.",
    tier: "write",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        patch: { type: "string" },
      },
      required: ["path", "patch"],
    },
  },
  {
    name: "rename_file",
    description: "Rename or move a file.",
    tier: "write",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file. This is destructive and usually requires user confirmation.",
    tier: "destructive",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
];

export function toolsForMode(mode: AgentMode): AgentToolSpec[] {
  if (mode === "ask") return AGENT_TOOLS.filter((t) => t.tier === "safe");
  return AGENT_TOOLS;
}

export function toOpenRouterTools(specs: AgentToolSpec[]) {
  return specs.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export function extractSymbols(path: string, text: string): string[] {
  const lines = text.split("\n");
  const out: string[] = [];
  const re =
    /^\s*(export\s+)?(async\s+)?(function|class|const|let|type|interface|enum)\s+([A-Za-z0-9_]+)/;
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i]);
    if (m) out.push(`${m[3]} ${m[4]}  (${path}:${i + 1})`);
    if (out.length >= 80) break;
  }
  return out;
}
