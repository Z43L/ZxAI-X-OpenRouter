import { extname } from "./path";

const EXT_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".mdx": "markdown",
  ".css": "css",
  ".scss": "scss",
  ".less": "less",
  ".html": "html",
  ".htm": "html",
  ".xml": "xml",
  ".svg": "xml",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "ini",
  ".ini": "ini",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".kt": "kotlin",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".php": "php",
  ".rb": "ruby",
  ".swift": "swift",
  ".sql": "sql",
  ".graphql": "graphql",
  ".vue": "html",
  ".svelte": "html",
  ".txt": "plaintext",
  ".env": "plaintext",
  ".gitignore": "plaintext",
  ".dockerignore": "plaintext",
};

const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".webm",
  ".wasm",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
]);

export function languageFromPath(path: string): string {
  const ext = extname(path).toLowerCase();
  if (EXT_LANG[ext]) return EXT_LANG[ext];
  const name = path.split("/").pop() ?? "";
  if (name === "Dockerfile") return "dockerfile";
  if (name === "Makefile") return "plaintext";
  if (name.startsWith(".env")) return "plaintext";
  return "plaintext";
}

export function isBinaryPath(path: string): boolean {
  return BINARY_EXT.has(extname(path).toLowerCase());
}

export function looksBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 8000);
  let suspicious = 0;
  for (let i = 0; i < n; i++) {
    if (bytes[i] === 0) return true;
    if (bytes[i] < 7 || (bytes[i] > 14 && bytes[i] < 32)) suspicious++;
  }
  return suspicious / n > 0.3;
}
