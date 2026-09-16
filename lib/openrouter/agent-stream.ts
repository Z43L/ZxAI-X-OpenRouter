import { OPENROUTER_BASE, buildHeaders, type OpenRouterHeaders } from "./client";
import { normalizeOpenRouterError, normalizeUpstreamError, networkError, type NormalizedError } from "./errors";
import { parseSSEStream } from "./sse";

export interface AgentChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: AccumulatedToolCall[];
}

export interface AccumulatedToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface AgentStreamEvent {
  content?: string;
  finishReason?: string | null;
  toolCalls?: AccumulatedToolCall[];
  model?: string;
}

export async function streamAgentCompletion(
  body: {
    model: string;
    messages: AgentChatMessage[];
    tools?: unknown[];
    temperature?: number;
    models?: string[];
  },
  headers: OpenRouterHeaders,
  opts: {
    signal?: AbortSignal;
    onEvent: (ev: AgentStreamEvent) => void;
  },
): Promise<{ ok: boolean; error?: NormalizedError; finishReason?: string | null; toolCalls: AccumulatedToolCall[]; text: string }> {
  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: buildHeaders(headers),
      body: JSON.stringify({ ...body, stream: true }),
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: true, toolCalls: [], text: "", finishReason: "user_stop" };
    }
    return { ok: false, error: networkError("Error de red. Comprueba tu conexión."), toolCalls: [], text: "" };
  }

  if (!res.ok || !res.body) {
    if (res.body) await res.body.cancel().catch(() => undefined);
    return { ok: false, error: await normalizeOpenRouterError(res), toolCalls: [], text: "" };
  }

  const acc = new ToolCallAccumulator();
  let text = "";
  let finishReason: string | null | undefined;

  try {
    for await (const chunk of parseSSEStream(res.body, opts.signal)) {
      if (chunk.error && !chunk.searchError) {
        return {
          ok: false,
          error: normalizeUpstreamError(chunk.error.code, chunk.error.message),
          toolCalls: acc.list(),
          text,
        };
      }
      if (chunk.content) {
        text += chunk.content;
        opts.onEvent({ content: chunk.content, model: chunk.model });
      }
      if (chunk.toolCalls?.length) acc.add(chunk.toolCalls);
      if (chunk.finishReason) finishReason = chunk.finishReason;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: true, toolCalls: acc.list(), text, finishReason: "user_stop" };
    }
    return { ok: false, error: networkError("Se interrumpió la conexión durante el streaming."), toolCalls: acc.list(), text };
  }

  const toolCalls = acc.list();
  opts.onEvent({ finishReason, toolCalls, content: undefined });
  return { ok: true, toolCalls, text, finishReason };
}

class ToolCallAccumulator {
  private byIndex = new Map<number, { id: string; name: string; args: string }>();

  add(deltas: { id?: string; index?: number; function?: { name?: string; arguments?: string } }[]) {
    deltas.forEach((d, i) => {
      const idx = typeof d.index === "number" ? d.index : i;
      const cur = this.byIndex.get(idx) ?? { id: "", name: "", args: "" };
      if (d.id) cur.id = d.id;
      if (d.function?.name) cur.name += d.function.name;
      if (d.function?.arguments) cur.args += d.function.arguments;
      this.byIndex.set(idx, cur);
    });
  }

  list(): AccumulatedToolCall[] {
    return [...this.byIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => ({
        id: v.id || `tool_${Math.random().toString(36).slice(2, 8)}`,
        type: "function" as const,
        function: { name: v.name, arguments: v.args },
      }))
      .filter((t) => t.function.name);
  }
}
