import {
  OPENROUTER_BASE,
  buildChatBody,
  buildHeaders,
  type ChatCompletionParams,
  type OpenRouterHeaders,
} from "./client";
import { normalizeOpenRouterError, normalizeUpstreamError, networkError, type NormalizedError } from "./errors";
import { parseSSEStream, type SSEChunk } from "./sse";

export type { SSEChunk };

export interface StreamCallbacks {
  onChunk: (chunk: SSEChunk) => void;
  signal?: AbortSignal;
}

export interface StreamResult {
  ok: boolean;
  error?: NormalizedError;
}

/**
 * Ejecuta un chat completion con streaming SSE.
 * No sabe nada de React: reporta cada chunk por callback.
 */
export async function streamChatCompletion(
  params: ChatCompletionParams,
  headers: OpenRouterHeaders,
  cb: StreamCallbacks,
): Promise<StreamResult> {
  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: buildHeaders(headers),
      body: JSON.stringify(buildChatBody(params)),
      signal: cb.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: true }; // parada por usuario, no es error
    }
    return { ok: false, error: networkError("Error de red. Comprueba tu conexión.") };
  }

  if (!res.ok || !res.body) {
    if (res.body) await res.body.cancel().catch(() => undefined);
    return { ok: false, error: await normalizeOpenRouterError(res) };
  }

  try {
    for await (const chunk of parseSSEStream(res.body, cb.signal)) {
      if (chunk.error) {
        if (chunk.searchError) {
          cb.onChunk(chunk);
          continue;
        }
        return {
          ok: false,
          error: normalizeUpstreamError(chunk.error.code, chunk.error.message),
        };
      }
      cb.onChunk(chunk);
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return { ok: true };
    return { ok: false, error: networkError("Se interrumpió la conexión durante el streaming.") };
  }
}
