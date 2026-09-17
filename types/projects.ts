export interface Project {
  id: string;
  name: string;
  icon: string;
  color: string;
  instructions: string;
  embeddingModel: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  path: string;
  content: string;
  bytes: number;
  language?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectChunk {
  id: string;
  projectId: string;
  fileId: string;
  filePath: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  createdAt: number;
}

export interface ChatProjectLink {
  chatId: string;
  projectId: string;
  createdAt: number;
}

export const DEFAULT_PROJECT_ICON = "📁";
export const DEFAULT_PROJECT_COLOR = "zinc";
export const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const PROJECT_RETRIEVAL_TOP_K = 8;
export const PROJECT_CHUNK_TARGET_CHARS = 3_200;
export const PROJECT_CHUNK_OVERLAP_CHARS = 400;
export const PROJECT_MAX_CONTEXT_CHARS = 60_000;

export const defaultProjectIcons = [
  "📁",
  "📚",
  "🧠",
  "🔬",
  "💡",
  "🛠️",
  "🎨",
  "🎵",
  "🎬",
  "📝",
  "🚀",
  "🌐",
];
