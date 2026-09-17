import { PROJECT_CHUNK_OVERLAP_CHARS, PROJECT_CHUNK_TARGET_CHARS } from "@/types/projects";
import { saveProjectChunks } from "./store";

export interface EmbeddingRequest {
  apiKey: string;
  model: string;
  input: string[];
}

export interface EmbeddingResponse {
  data: { index: number; embedding: number[] }[];
}

export interface EmbeddingProvider {
  embed(req: EmbeddingRequest): Promise<EmbeddingResponse>;
}

export class OpenRouterEmbeddings implements EmbeddingProvider {
  constructor(
    private readonly siteTitle?: string,
    private readonly siteReferer?: string,
  ) {}

  async embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${req.apiKey}`,
    };
    if (this.siteReferer) headers["HTTP-Referer"] = this.siteReferer;
    if (this.siteTitle) {
      headers["X-Title"] = this.siteTitle;
      headers["X-OpenRouter-Title"] = this.siteTitle;
    }
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers,
      body: JSON.stringify({ model: req.model, input: req.input }),
    });
    if (!res.ok) {
      throw new Error(`Embeddings falló: HTTP ${res.status}`);
    }
    const data = (await res.json()) as EmbeddingResponse;
    if (!Array.isArray(data.data)) throw new Error("Embeddings: respuesta inválida");
    return data;
  }
}

export function chunkText(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, "\n");
  const lines = cleaned.split("\n");
  const chunks: string[] = [];
  let buf = "";
  const flush = () => {
    if (buf.trim().length > 0) chunks.push(buf.trim());
    buf = "";
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = buf.length === 0 ? line : `${buf}\n${line}`;
    if (next.length > PROJECT_CHUNK_TARGET_CHARS && buf.length > 0) {
      flush();
      const tail = buf.slice(Math.max(0, buf.length - PROJECT_CHUNK_OVERLAP_CHARS));
      buf = tail;
    }
    buf = next;
  }
  flush();
  return chunks;
}

export async function reindexProject(opts: {
  projectId: string;
  files: Array<{ id: string; path: string; content: string }>;
  embedder: EmbeddingProvider;
  model: string;
  apiKey: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<{ chunks: number }> {
  await clearProjectChunks(opts.projectId);
  const allText: { projectId: string; fileId: string; filePath: string; chunkIndex: number; text: string }[] = [];
  for (const f of opts.files) {
    const chunks = chunkText(f.content);
    chunks.forEach((text, i) => {
      allText.push({
        projectId: opts.projectId,
        fileId: f.id,
        filePath: f.path,
        chunkIndex: i,
        text,
      });
    });
  }
  if (allText.length === 0) return { chunks: 0 };

  let done = 0;
  for (let start = 0; start < allText.length; start += 64) {
    const batch = allText.slice(start, start + 64);
    const embeddings = await opts.embedder.embed({
      apiKey: opts.apiKey,
      model: opts.model,
      input: batch.map((b) => b.text),
    });
    const items = batch.map((b, i) => ({
      ...b,
      embedding: embeddings.data[i]?.embedding ?? [],
    }));
    await saveProjectChunks(items);
    done += batch.length;
    opts.onProgress?.(done, allText.length);
  }
  return { chunks: allText.length };
}

export async function clearProjectChunks(projectId: string): Promise<void> {
  const { clearProjectChunks: clearFn } = await import("./store");
  await clearFn(projectId);
}
