import type { Attachment, AttachmentKind } from "@/types/attachments";
import { ATTACHMENT_LIMITS } from "@/types/attachments";

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "jsonc",
  "json5",
  "csv",
  "tsv",
  "log",
  "xml",
  "yaml",
  "yml",
  "ini",
  "toml",
  "conf",
  "env",
  "properties",
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "rb",
  "rs",
  "go",
  "java",
  "kt",
  "swift",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "php",
  "sh",
  "bash",
  "zsh",
  "sql",
  "html",
  "htm",
  "css",
  "scss",
  "less",
  "vue",
  "svelte",
  "astro",
  "tex",
  "rst",
  "adoc",
]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif", "heic"]);

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg", "flac", "aac", "aiff", "opus"]);

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "mkv", "avi"]);

const ZIP_EXTENSIONS = new Set(["zip", "zipx", "jar", "war", "apk"]);

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  json: "json",
  jsonc: "json",
  json5: "json",
  xml: "xml",
  yml: "yaml",
  yaml: "yaml",
  md: "markdown",
  markdown: "markdown",
  toml: "toml",
  tex: "tex",
};

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function classifyExtension(name: string, declaredMime?: string): AttachmentKind {
  const ext = extOf(name);
  if (ZIP_EXTENSIONS.has(ext)) return "zip";
  if (TEXT_EXTENSIONS.has(ext)) return "text";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (declaredMime) {
    if (declaredMime.startsWith("text/") || declaredMime.includes("json") || declaredMime.includes("xml")) return "text";
    if (declaredMime.startsWith("image/")) return "image";
    if (declaredMime.startsWith("audio/")) return "audio";
    if (declaredMime.startsWith("video/")) return "video";
    if (declaredMime.includes("zip")) return "zip";
  }
  return "binary";
}

export function isTextKind(kind: AttachmentKind): boolean {
  return kind === "text";
}

export function isZipKind(kind: AttachmentKind): boolean {
  return kind === "zip";
}

export function languageFromName(name: string): string | undefined {
  const ext = extOf(name);
  return LANGUAGE_BY_EXT[ext];
}

export interface ParsedTextFile {
  text: string;
  truncated: boolean;
  lineCount: number;
}

export async function readTextFile(file: File | Blob): Promise<ParsedTextFile> {
  const buffer = await file.arrayBuffer();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let text = decoder.decode(buffer);
  let truncated = false;
  if (text.length > ATTACHMENT_LIMITS.maxTextChars) {
    text = text.slice(0, ATTACHMENT_LIMITS.maxTextChars);
    truncated = true;
  }
  const lineCount = text.length ? text.split("\n").length : 0;
  return { text, truncated, lineCount };
}

export function makeAttachment(args: {
  file: File | Blob;
  origin: Attachment["origin"];
  parentZipId?: string;
}): Attachment {
  const file = args.file;
  const name = "name" in file && typeof file.name === "string" ? file.name : "archivo";
  const kind = classifyExtension(name, file.type || undefined);
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name,
    size: file.size,
    mimeType: file.type || "",
    kind,
    origin: args.origin,
    parentZipId: args.parentZipId,
  };
}
