import { PROJECT_MAX_CONTEXT_CHARS } from "@/types/projects";
import { getProject } from "./store";
import { OpenRouterEmbeddings } from "./embeddings";
import { retrieveTopK } from "./retrieval";

export interface BuildContextOpts {
  apiKey: string;
  siteTitle?: string;
  siteReferer?: string;
  topK?: number;
  embeddingModel?: string;
}

export async function embedQuery(
  query: string,
  model: string,
  apiKey: string,
  siteTitle?: string,
  siteReferer?: string,
): Promise<number[]> {
  const provider = new OpenRouterEmbeddings(siteTitle, siteReferer);
  const res = await provider.embed({ apiKey, model, input: [query] });
  const vec = res.data?.[0]?.embedding;
  if (!vec) throw new Error("Embeddings: vector vacío");
  return vec;
}

export async function buildProjectContext(
  projectId: string,
  query: string,
  opts: BuildContextOpts,
): Promise<string> {
  const project = await getProject(projectId);
  if (!project) return "";
  const embModel = opts.embeddingModel ?? project.embeddingModel;
  const queryVec = await embedQuery(query, embModel, opts.apiKey, opts.siteTitle, opts.siteReferer);
  const top = await retrieveTopK(projectId, queryVec, opts.topK ?? 8);
  if (top.length === 0) return project.instructions?.trim() ? `# Proyecto: ${project.name}\n${project.instructions}` : "";

  const parts: string[] = [];
  if (project.instructions.trim()) {
    parts.push(`# Instrucciones del proyecto (${project.name})\n${project.instructions.trim()}`);
  }
  parts.push(`# Contexto relevante del proyecto (${project.name})`);
  let budget = 0;
  for (const r of top) {
    const block = `\n## Fuente: ${r.chunk.filePath} (chunk ${r.chunk.chunkIndex + 1}, similitud ${r.score.toFixed(2)})\n${r.chunk.text}`;
    if (budget + block.length > PROJECT_MAX_CONTEXT_CHARS) break;
    parts.push(block);
    budget += block.length;
  }
  return parts.join("\n\n");
}
