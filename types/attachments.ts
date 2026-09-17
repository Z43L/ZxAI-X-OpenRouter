export interface Attachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  kind: AttachmentKind;
  origin: "picked" | "zip";
  parentZipId?: string;
}

export type AttachmentKind = "text" | "image" | "audio" | "video" | "binary" | "zip";

export interface ParsedAttachment extends Attachment {
  text?: string;
  truncated: boolean;
  bytes: number;
  lineCount?: number;
  language?: string;
}

export interface AttachmentParseResult {
  attachments: ParsedAttachment[];
  warnings: string[];
  totalBytes: number;
  skipped: number;
}

export const ATTACHMENT_LIMITS = {
  maxFiles: 50,
  maxFileBytes: 200 * 1024,
  maxTotalBytes: 2 * 1024 * 1024,
  maxZipRecursion: 1,
  maxTextChars: 200_000,
} as const;
