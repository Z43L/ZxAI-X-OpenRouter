import type { AgentActivity, AIChangeSet, CodeMessage, ToolCallRequest } from "@/types/agent";
import type { AgentMode, AiPermissionConfig } from "@/types/code";
import type { WorkspaceProvider } from "@/types/workspace";
import { newId } from "@/lib/utils/ids";
import { streamAgentCompletion, type AgentChatMessage, type AccumulatedToolCall } from "@/lib/openrouter/agent-stream";
import { buildAgentContext, contextToSystemPrompt } from "./context-builder";
import { toolsForMode, toOpenRouterTools } from "./tools";
import { WorkspaceToolExecutor, type EditorBridge } from "./tool-executor";

const MAX_STEPS = 16;

export interface AgentRunInput {
  workspace: WorkspaceProvider;
  bridge: EditorBridge;
  permissions: AiPermissionConfig;
  mode: AgentMode;
  model: string;
  userText: string;
  history: CodeMessage[];
  apiKey: string;
  siteTitle: string;
  siteReferer: string;
  temperature: number;
  signal: AbortSignal;
  onText: (delta: string) => void;
  onActivity: (a: AgentActivity) => void;
  onChangeSet: (cs: AIChangeSet) => void;
  requestSensitiveAccess: (path: string) => Promise<boolean>;
  requestDelete: (path: string) => Promise<boolean>;
}

export async function runCodingAgent(input: AgentRunInput): Promise<{ text: string; changeSet: AIChangeSet }> {
  const ctx = await buildAgentContext({ workspace: input.workspace, bridge: input.bridge });
  const changeSet: AIChangeSet = {
    id: newId(),
    workspaceId: input.workspace.id,
    files: [],
    summary: "",
    status: "proposed",
    createdAt: Date.now(),
  };

  const allowed = new Set(input.bridge.openFiles());
  const cur = input.bridge.currentFile();
  if (cur) allowed.add(cur.path);

  const executor = new WorkspaceToolExecutor(
    input.workspace,
    input.permissions,
    input.bridge,
    {
      onActivity: (a) => {
        a.status = "done";
        input.onActivity(a);
      },
      requestSensitiveAccess: input.requestSensitiveAccess,
      requestDelete: input.requestDelete,
    },
    input.mode,
    input.mode === "edit" ? allowed : undefined,
  );

  const messages: AgentChatMessage[] = [
    { role: "system", content: contextToSystemPrompt(ctx, input.mode) },
    ...historyToMessages(input.history),
    { role: "user", content: input.userText },
  ];

  const tools = toOpenRouterTools(toolsForMode(input.mode));
  let text = "";

  for (let step = 0; step < MAX_STEPS; step++) {
    if (input.signal.aborted) break;
    input.onActivity({
      id: newId(),
      kind: step === 0 ? "plan" : "explore",
      label: step === 0 ? "Pensando" : "Continuando",
      status: "running",
    });

    const result = await streamAgentCompletion(
      {
        model: input.model,
        messages,
        tools,
        temperature: input.temperature,
      },
      { apiKey: input.apiKey, siteTitle: input.siteTitle, siteReferer: input.siteReferer },
      {
        signal: input.signal,
        onEvent: (ev) => {
          if (ev.content) {
            text += ev.content;
            input.onText(ev.content);
          }
        },
      },
    );

    if (!result.ok) {
      throw new Error(result.error?.message ?? "Error del modelo.");
    }
    if (result.finishReason === "user_stop" || input.signal.aborted) break;

    if (result.toolCalls.length === 0) {
      text = result.text || text;
      break;
    }

    messages.push({
      role: "assistant",
      content: result.text || null,
      tool_calls: result.toolCalls,
    });

    for (const tc of result.toolCalls) {
      if (input.signal.aborted) break;
      const req = parseToolCall(tc);
      const out = await executor.execute(req, changeSet);
      if (changeSet.files.length) input.onChangeSet({ ...changeSet, files: [...changeSet.files] });
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: out.content,
      });
    }
  }

  if (changeSet.files.length) {
    changeSet.summary = `${changeSet.files.length} archivo(s)`;
    input.onChangeSet({ ...changeSet, files: [...changeSet.files] });
  }
  return { text, changeSet };
}

function parseToolCall(tc: AccumulatedToolCall): ToolCallRequest {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
  } catch {
    args = {};
  }
  return { id: tc.id, name: tc.function.name, arguments: args };
}

function historyToMessages(history: CodeMessage[]): AgentChatMessage[] {
  return history
    .filter((m) => m.status === "complete" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role === "system" ? "system" : m.role, content: m.content }));
}
