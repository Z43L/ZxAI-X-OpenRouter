import { newId } from "@/lib/utils/ids";
import type { StudioClip, StudioParams } from "@/types/studio";

export interface MusicJobSpec {
  apiKey: string;
  model: string;
  prompt: string;
  params: StudioParams;
  siteTitle?: string;
  siteReferer?: string;
}

export interface MusicJobResult {
  dataUrl: string;
  format: string;
  bytes: number;
  transcript?: string;
  raw?: unknown;
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

function buildHeaders(spec: MusicJobSpec): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${spec.apiKey}`,
    "Content-Type": "application/json",
  };
  if (spec.siteReferer) h["HTTP-Referer"] = spec.siteReferer;
  if (spec.siteTitle) {
    h["X-Title"] = spec.siteTitle;
    h["X-OpenRouter-Title"] = spec.siteTitle;
  }
  return h;
}

function mimeForFormat(fmt: string): string {
  switch (fmt) {
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    case "flac":
      return "audio/flac";
    case "opus":
      return "audio/ogg; codecs=opus";
    case "pcm16":
      return "audio/pcm";
    default:
      return "audio/wav";
  }
}

/**
 * Genera un clip de música vía OpenRouter.
 *
 * OpenRouter exige `stream: true` para `output_modalities` que incluyen
 * `audio`. La respuesta es SSE y los chunks llegan con
 * `choices[0].delta.audio.{data,transcript}` (base64 incremental).
 *
 * Estrategia:
 * 1. `/chat/completions` con `stream: true` + `modalities:["text","audio"]`.
 *    Acumulamos los chunks base64 de `delta.audio.data` hasta `[DONE]`.
 * 2. Si el modelo no emite audio en el stream (responde solo texto),
 *    parseamos el `content` final como un posible JSON con `output.{url,data}`.
 * 3. Endpoints `/audio/generations`, `/generations/audio`, `/video/generations`
 *    como fallback últimos.
 */
export async function generateMusicClip(
  spec: MusicJobSpec,
  signal?: AbortSignal,
): Promise<MusicJobResult> {
  if (!spec.model) {
    throw new Error("No hay modelo seleccionado. Elige uno en el selector de modelos de Studio.");
  }
  if (!spec.prompt.trim()) {
    throw new Error("El prompt está vacío. Describe el estilo de música que quieres generar.");
  }

  const headers = buildHeaders(spec);
  const fallbackFormat = spec.params.audio.format;
  const attempts: string[] = [];

  // Vía 1: chat/completions en streaming (requerido para audio).
  try {
    const chatBody = {
      model: spec.model,
      stream: true,
      modalities: ["text", "audio"],
      audio: {
        voice: spec.params.audio.voice ?? "alloy",
        format: fallbackFormat,
      },
      messages: [{ role: "user", content: spec.prompt }],
      temperature: 1,
    };
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(chatBody),
      signal,
    });

    if (res.ok) {
      const ct = (res.headers.get("content-type") ?? "").toLowerCase();
      // Si por algún motivo llega binario directo (no debería con stream).
      if (ct.startsWith("audio/") || ct.startsWith("application/octet-stream")) {
        const buf = new Uint8Array(await res.arrayBuffer());
        return finalizeFromBytes(buf, fallbackFormat);
      }
      const streamResult = await consumeAudioStream(res, fallbackFormat, signal);
      if (streamResult) return streamResult;
      throw new Error("Stream sin payload de audio (el modelo devolvió solo texto).");
    }

    const errText = await res.text().catch(() => "");
    attempts.push(`POST /chat/completions → HTTP ${res.status} ${errText.slice(0, 220)}`);
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Sin autorización para ${spec.model} (HTTP ${res.status}). Comprueba tu API key y los créditos.`,
      );
    }
    if (res.status === 400 && /audio output requires stream/i.test(errText)) {
      // Fallar rápido: ya hemos intentado con stream=true arriba; si llegamos
      // aquí probablemente el cuerpo se envío sin stream por error.
      throw new Error(
        `OpenRouter rechazó el request: el cuerpo debe usar streaming para output de audio.`,
      );
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new Error("Generación cancelada");
    if ((e as Error)?.message === "Generación cancelada") throw e;
    const msg = (e as Error)?.message ?? String(e);
    if (msg.startsWith("Sin autorización")) throw e;
    attempts.push(`chat-completions error: ${msg}`);
  }

  // Vías de fallback: endpoints dedicados.
  for (const path of ["/audio/generations", "/generations/audio", "/video/generations"]) {
    try {
      const res = await fetch(`${OPENROUTER_BASE}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(buildGenerationBody(spec)),
        signal,
      });
      if (res.status === 404) {
        attempts.push(`POST ${path} → 404 no existe`);
        continue;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        attempts.push(`POST ${path} → HTTP ${res.status} ${txt.slice(0, 220)}`);
        continue;
      }
      const ct = (res.headers.get("content-type") ?? "").toLowerCase();
      if (ct.startsWith("audio/") || ct.startsWith("application/octet-stream")) {
        const buf = new Uint8Array(await res.arrayBuffer());
        return finalizeFromBytes(buf, fallbackFormat);
      }
      const json = (await res.json()) as {
        status?: string;
        output?: { url?: string; data?: string; format?: string; transcript?: string };
        error?: string;
      };
      if (json.error) throw new Error(`Música falló: ${json.error}`);
      if (json.output?.url) return finalizeFromUrl(json.output.url, json.output.format ?? fallbackFormat);
      if (json.output?.data) {
        const f = json.output.format ?? fallbackFormat;
        return finalizeFromBase64(json.output.data, f, json.output.transcript);
      }
      if (json.status === "completed" && json.output === undefined) {
        // Espera… hemos recibido un 200 "completed" sin output. Continuar probando.
        attempts.push(`POST ${path} → 200 completed sin output`);
        continue;
      }
      attempts.push(`POST ${path} → 200 sin payload de audio claro`);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw new Error("Generación cancelada");
      if ((e as Error)?.message === "Generación cancelada") throw e;
      attempts.push(`${path} error: ${(e as Error)?.message ?? String(e)}`);
    }
  }

  throw new Error(
    `No se pudo generar audio con "${spec.model}". Detalle: ${attempts.join(" | ")}`,
  );
}

interface AudioChunkState {
  base64: string;
  transcript: string;
  finished: boolean;
  errorMessage?: string;
  contentText: string;
}

async function consumeAudioStream(
  res: Response,
  fallbackFormat: string,
  signal?: AbortSignal,
): Promise<MusicJobResult | null> {
  if (!res.body) return null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const state: AudioChunkState = { base64: "", transcript: "", finished: false, contentText: "" };
  let buffer = "";

  try {
    while (!state.finished) {
      if (signal?.aborted) throw new DOMException("AbortError", "AbortError");
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nlIdx: number;
      while ((nlIdx = buffer.indexOf("\n")) >= 0) {
        const rawLine = buffer.slice(0, nlIdx);
        buffer = buffer.slice(nlIdx + 1);
        const line = rawLine.trim();
        if (!line || line.startsWith(":")) continue;
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") {
          state.finished = true;
          break;
        }
        parseStreamPayload(payload, state);
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  if (state.errorMessage) {
    throw new Error(state.errorMessage);
  }
  if (state.base64) {
    return {
      dataUrl: `data:${mimeForFormat(fallbackFormat)};base64,${state.base64}`,
      format: fallbackFormat,
      bytes: Math.round((state.base64.length * 3) / 4),
      transcript: state.transcript || undefined,
      raw: state,
    };
  }
  if (state.contentText) {
    const parsed = tryParseJobFromContent(state.contentText);
    if (parsed?.output?.data) {
      return finalizeFromBase64(parsed.output.data, parsed.output.format ?? fallbackFormat, parsed.output.transcript);
    }
    if (parsed?.output?.url) return finalizeFromUrl(parsed.output.url, parsed.output.format ?? fallbackFormat);
  }
  return null;
}

function parseStreamPayload(payload: string, state: AudioChunkState): void {
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return;
  }
  const obj = json as Record<string, unknown>;
  const err = obj.error as { message?: string } | undefined;
  if (err?.message) {
    state.errorMessage = err.message;
    state.finished = true;
    return;
  }
  const choices = obj.choices as Array<{
    delta?: {
      audio?: { data?: string; transcript?: string };
      content?: string;
    };
    finish_reason?: string;
  }> | undefined;
  const choice = choices?.[0];
  const delta = choice?.delta;
  if (delta?.audio?.data) {
    state.base64 += delta.audio.data;
  }
  if (delta?.audio?.transcript) {
    state.transcript += delta.audio.transcript;
  }
  if (delta?.content) {
    state.contentText += delta.content;
  }
  if (choice?.finish_reason === "stop" || choice?.finish_reason === "length") {
    // No marcamos finished aquí: solo cuando llegue [DONE]; algunos modelos
    // emiten finish_reason antes de los últimos chunks de audio.
  }
}

function buildGenerationBody(spec: MusicJobSpec): Record<string, unknown> {
  const params = spec.params;
  return {
    model: spec.model,
    prompt: spec.prompt,
    duration: params.durationSec ?? 30,
    bpm: params.bpm,
    key: params.key,
    mood: params.mood,
    instruments: params.instruments ?? [],
    format: params.audio.format,
    voice: params.audio.voice,
  };
}

interface JobResponse {
  output?: { url?: string; data?: string; format?: string; transcript?: string };
}

function tryParseJobFromContent(content: string): JobResponse | null {
  try {
    const parsed = JSON.parse(content) as JobResponse;
    if (parsed && typeof parsed === "object" && parsed.output) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

async function finalizeFromUrl(url: string, format: string): Promise<MusicJobResult> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Descarga falló: HTTP ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  return finalizeFromBytes(buf, format);
}

function finalizeFromBytes(bytes: Uint8Array, format: string): MusicJobResult {
  const b64 = base64FromBytes(bytes);
  return {
    dataUrl: `data:${mimeForFormat(format)};base64,${b64}`,
    format,
    bytes: bytes.length,
    raw: undefined,
  };
}

function finalizeFromBase64(b64: string, format: string, transcript?: string): MusicJobResult {
  return {
    dataUrl: `data:${mimeForFormat(format)};base64,${b64}`,
    format,
    bytes: Math.round((b64.length * 3) / 4),
    transcript,
    raw: undefined,
  };
}

function base64FromBytes(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

export function makeStudioClip(
  params: StudioParams,
  prompt: string,
  result: MusicJobResult,
): StudioClip {
  return {
    id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    index: 0,
    prompt,
    transcript: result.transcript ?? "",
    dataUrl: result.dataUrl,
    format: result.format,
    bytes: result.bytes,
    model: params.model,
    params: { ...params },
    createdAt: Date.now(),
  };
}

export function assertNever(_x: never): never {
  throw new Error("Caso no implementado");
}

export { newId };
