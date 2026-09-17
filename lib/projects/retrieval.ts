import type { ProjectChunk } from "@/types/projects";
import { PROJECT_RETRIEVAL_TOP_K } from "@/types/projects";
import { listProjectChunks } from "./store";

export interface RetrievalResult {
  chunk: ProjectChunk;
  score: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export async function retrieveTopK(
  projectId: string,
  queryEmbedding: number[],
  k: number = PROJECT_RETRIEVAL_TOP_K,
): Promise<RetrievalResult[]> {
  const chunks = await listProjectChunks(projectId);
  if (chunks.length === 0) return [];
  const scored: RetrievalResult[] = [];
  for (const c of chunks) {
    if (!c.embedding || c.embedding.length === 0) continue;
    const score = cosineSimilarity(queryEmbedding, c.embedding);
    scored.push({ chunk: c, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).filter((r) => r.score > 0.1);
}
