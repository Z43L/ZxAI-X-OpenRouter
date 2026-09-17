import type { AttachmentParseResult, ParsedAttachment } from "@/types/attachments";
import { ATTACHMENT_LIMITS } from "@/types/attachments";
import {
  classifyExtension,
  isTextKind,
  isZipKind,
  languageFromName,
  makeAttachment,
  readTextFile,
} from "./parse";
import { extractZip } from "./extract-zip";

export interface ParseOptions {
  /** Profundidad de anidamiento para zips (0 = no se extraen zips anidados). */
  zipDepth?: number;
}

export async function parseAttachment(
  file: File,
  depth = 0,
): Promise<{ parent: ParsedAttachment | null; result: AttachmentParseResult }> {
  const warnings: string[] = [];
  let parent: ParsedAttachment | null = null;
  let attachments: ParsedAttachment[] = [];
  let totalBytes = 0;
  let skipped = 0;

  const kind = classifyExtension(file.name, file.type || undefined);

  if (isZipKind(kind)) {
    if (depth >= ATTACHMENT_LIMITS.maxZipRecursion) {
      warnings.push(`Zip anidado ignorado (profundidad máxima ${ATTACHMENT_LIMITS.maxZipRecursion}).`);
      return {
        parent: makeAttachment({ file, origin: "picked" }) as ParsedAttachment,
        result: {
          attachments: [],
          warnings,
          totalBytes: file.size,
          skipped: 1,
        },
      };
    }
    const zipId = makeAttachment({ file, origin: "picked" }).id;
    const extracted = await extractZip(file, zipId);
    warnings.push(...extracted.warnings);
    attachments = extracted.attachments;
    skipped = extracted.skipped;
    totalBytes = attachments.reduce((sum, a) => sum + a.bytes, 0);
  } else if (isTextKind(kind)) {
    const { text, truncated, lineCount } = await readTextFile(file);
    const att = makeAttachment({ file, origin: "picked" });
    parent = {
      ...att,
      kind: "text",
      text,
      truncated,
      bytes: file.size,
      lineCount,
      language: languageFromName(file.name),
    };
    attachments = [parent];
    totalBytes = file.size;
  } else {
    skipped++;
    warnings.push(`Archivo ignorado (tipo no soportado como contexto): ${file.name}`);
  }

  return {
    parent,
    result: {
      attachments,
      warnings,
      totalBytes,
      skipped,
    },
  };
}

export async function parseAttachments(
  files: FileList | File[],
  options: ParseOptions = {},
): Promise<AttachmentParseResult> {
  const list = Array.from(files instanceof FileList ? files : files);
  const warnings: string[] = [];
  const allAttachments: ParsedAttachment[] = [];
  let totalBytes = 0;
  let skipped = 0;

  const limit = ATTACHMENT_LIMITS.maxFiles;
  if (list.length > limit) {
    skipped += list.length - limit;
    warnings.push(`Se omitieron ${list.length - limit} archivos (máximo ${limit}).`);
  }
  const limited = list.slice(0, limit);

  for (const file of limited) {
    const { parent, result } = await parseAttachment(file, options.zipDepth ?? 0);
    if (parent) allAttachments.push(parent);
    allAttachments.push(...result.attachments);
    warnings.push(...result.warnings);
    totalBytes += result.totalBytes + (file.size ?? 0);
    skipped += result.skipped;
    if (totalBytes > ATTACHMENT_LIMITS.maxTotalBytes) {
      const over = `Total de adjuntos supera ${Math.round(ATTACHMENT_LIMITS.maxTotalBytes / 1024)} KB. Se corta el procesado.`;
      warnings.push(over);
      break;
    }
  }

  return { attachments: allAttachments, warnings, totalBytes, skipped };
}

export function buildAttachmentContext(attachments: ParsedAttachment[]): string {
  if (attachments.length === 0) return "";
  const lines: string[] = ["Archivos adjuntos del usuario:"];
  let idx = 0;
  for (const a of attachments) {
    if (!a.text || !isTextKind(a.kind)) continue;
    idx++;
    lines.push(`\n# Adjunto ${idx}: ${a.name} (${a.bytes} bytes${a.truncated ? " truncado" : ""})`);
    lines.push("```" + (a.language ?? ""));
    lines.push(a.text);
    lines.push("```");
  }
  if (idx === 0) {
    lines.push("(Los adjuntos son binarios y no se incluyen como texto; considéralos como referencia.)");
  }
  return lines.join("\n");
}

export { classifyExtension, isTextKind, isZipKind, makeAttachment, readTextFile };
