import type { Chat } from "@/types/chat";

export interface TitleGenerationOpts {
  apiKey: string;
  model?: string;
  siteTitle?: string;
  siteReferer?: string;
  baseUrl?: string;
}

const TITLE_SYSTEM = [
  "Eres un asistente que asigna títulos concisos a conversaciones.",
  "Reglas estrictas:",
  "- Devuelve SOLO el título, sin comillas, sin punto final, sin emojis.",
  "- Máximo 6 palabras.",
  "- En el mismo idioma que el usuario.",
  "- Resume el objetivo o tema principal de la conversación.",
].join("\n");

function sanitize(raw: string): string {
  return raw
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^Título:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/g, "");
}

export async function generateChatTitle(chat: Chat, opts: TitleGenerationOpts): Promise<string | null> {
  const baseUrl = opts.baseUrl ?? "https://openrouter.ai/api/v1";
  const userTurns = chat.messages
    .filter((m) => m.role === "user" && m.content.trim().length > 0)
    .slice(0, 3)
    .map((m) => m.content.slice(0, 600));
  const assistantTurns = chat.messages
    .filter((m) => m.role === "assistant" && m.content.trim().length > 0)
    .slice(0, 3)
    .map((m) => m.content.slice(0, 600));

  if (userTurns.length === 0) return null;

  const parts: string[] = ["Conversación:"];
  for (let i = 0; i < Math.max(userTurns.length, assistantTurns.length); i++) {
    if (userTurns[i]) parts.push(`Usuario: ${userTurns[i]}`);
    if (assistantTurns[i]) parts.push(`Asistente: ${assistantTurns[i]}`);
  }
  parts.push("\nDevuelve solo el título.");

  const body = {
    model: opts.model ?? "openrouter/auto",
    messages: [
      { role: "system", content: TITLE_SYSTEM },
      { role: "user", content: parts.join("\n") },
    ],
    stream: false,
    max_completion_tokens: 32,
    temperature: 0.4,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${opts.apiKey}`,
  };
  if (opts.siteReferer) headers["HTTP-Referer"] = opts.siteReferer;
  if (opts.siteTitle) {
    headers["X-Title"] = opts.siteTitle;
    headers["X-OpenRouter-Title"] = opts.siteTitle;
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) return null;
    const cleaned = sanitize(raw);
    if (!cleaned) return null;
    const truncated = cleaned.length > 60 ? cleaned.slice(0, 60).trimEnd() + "…" : cleaned;
    return truncated;
  } catch {
    return null;
  }
}
