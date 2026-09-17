import type { StudioClip, StudioMessage, StudioParams, StudioSession } from "@/types/studio";
import { DEFAULT_STUDIO_PARAMS } from "@/types/studio";
import { newId } from "@/lib/utils/ids";
import { generateChatTitle } from "@/lib/storage/title-generator";
import { generateMusicClip, makeStudioClip } from "@/lib/media/music-gen";

export interface GenerateOpts {
  apiKey: string;
  siteTitle?: string;
  siteReferer?: string;
  signal: AbortSignal;
}

export async function generateOneClip(
  params: StudioParams,
  prompt: string,
  opts: GenerateOpts,
): Promise<StudioClip> {
  const result = await generateMusicClip(
    {
      apiKey: opts.apiKey,
      model: params.model,
      prompt,
      params,
      siteTitle: opts.siteTitle,
      siteReferer: opts.siteReferer,
    },
    opts.signal,
  );
  const clip = makeStudioClip(params, prompt, result);
  return clip;
}

const AGENT_SYSTEM = [
  "Eres un director musical que ajusta la dirección de cada clip en función de lo generado.",
  "Devuelve SOLO un JSON con estos campos exactos:",
  '{ "bpm": number 60-180, "key": "<nota>", "mood": "<palabra>", "instruments": ["<instrumento>"], "reasoning": "<breve nota en español>" }',
  "Mantén coherencia con la pista: si estaba relajada, no pases a agresivo de golpe.",
].join("\n");

export interface AgentDecision extends Partial<StudioParams> {
  reasoning?: string;
}

export async function askAgentDecision(
  history: StudioMessage[],
  clips: StudioClip[],
  params: StudioParams,
  apiKey: string,
  siteTitle?: string,
  siteReferer?: string,
): Promise<AgentDecision | null> {
  const recent = clips.slice(-3).map((c) => `- ${c.prompt}`).join("\n");
  const userPrompt =
    `Pista actual: ${params.prompt}\n` +
    `Últimos prompts:\n${recent}\n\n` +
    `Sugiere los próximos parámetros. Devuelve SOLO el JSON.`;
  const body = {
    model: params.model,
    messages: [
      { role: "system", content: AGENT_SYSTEM },
      { role: "user", content: userPrompt },
    ],
    stream: false,
    temperature: 0.7,
  };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (siteReferer) headers["HTTP-Referer"] = siteReferer;
  if (siteTitle) {
    headers["X-Title"] = siteTitle;
    headers["X-OpenRouter-Title"] = siteTitle;
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as AgentDecision;
    return parsed;
  } catch {
    return null;
  }
}

export function buildStudioSession(name: string, mode: "manual" | "agent"): StudioSession {
  const now = Date.now();
  return {
    id: `session-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    mode,
    params: { ...DEFAULT_STUDIO_PARAMS, prompt: name },
    clips: [],
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function appendClip(session: StudioSession, clip: StudioClip, nextIndex?: number): StudioSession {
  return {
    ...session,
    clips: [...session.clips, { ...clip, index: nextIndex ?? session.clips.length }],
    updatedAt: Date.now(),
  };
}

export function appendMessage(
  session: StudioSession,
  message: Omit<StudioMessage, "id" | "createdAt">,
): StudioSession {
  return {
    ...session,
    messages: [
      ...session.messages,
      { ...message, id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now() },
    ],
    updatedAt: Date.now(),
  };
}

export function patchParams(session: StudioSession, patch: Partial<StudioParams>): StudioSession {
  return {
    ...session,
    params: { ...session.params, ...patch, audio: { ...session.params.audio, ...(patch.audio ?? {}) } },
    updatedAt: Date.now(),
  };
}

export { generateChatTitle, newId };
