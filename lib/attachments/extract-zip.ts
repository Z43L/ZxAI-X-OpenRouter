import { unzipSync, strFromU8 } from "fflate";
import { classifyExtension, languageFromName, makeAttachment, readTextFile } from "./parse";
import type { Attachment, ParsedAttachment } from "@/types/attachments";
import { ATTACHMENT_LIMITS } from "@/types/attachments";

export interface ZipLimits {
  maxEntries: number;
  maxFileBytes: number;
  maxDepth: number;
}

const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxEntries: ATTACHMENT_LIMITS.maxFiles,
  maxFileBytes: ATTACHMENT_LIMITS.maxFileBytes,
  maxDepth: ATTACHMENT_LIMITS.maxZipRecursion,
};

function isSafeEntryName(name: string): boolean {
  if (!name || name.endsWith("/")) return true;
  if (name.startsWith("/")) return false;
  if (name.includes("..")) return false;
  if (/^[a-zA-Z]:[\\/]/.test(name)) return false;
  return true;
}

function isProbablyBinary(buffer: Uint8Array): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    if (b === 0) return true;
    if (b < 9 || (b > 13 && b < 32 && b !== 27)) nonPrintable++;
  }
  return nonPrintable / sample.length > 0.15;
}

export interface ExtractedZip {
  parent: Attachment;
  attachments: ParsedAttachment[];
  warnings: string[];
  skipped: number;
}

export async function extractZip(
  file: File,
  parentZipId: string,
  limits: ZipLimits = DEFAULT_ZIP_LIMITS,
): Promise<ExtractedZip> {
  const warnings: string[] = [];
  const buffer = new Uint8Array(await file.arrayBuffer());
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(buffer, { filter: (info) => isSafeEntryName(info.name) });
  } catch (e) {
    warnings.push(`No se pudo descomprimir: ${e instanceof Error ? e.message : "formato inválido"}`);
    return {
      parent: makeAttachment({ file, origin: "picked" }),
      attachments: [],
      warnings,
      skipped: 1,
    };
  }

  const names = Object.keys(entries).sort();
  const parent = makeAttachment({ file, origin: "picked" });
  const attachments: ParsedAttachment[] = [];
  let skipped = 0;

  const limited = names.slice(0, limits.maxEntries);
  if (names.length > limited.length) {
    skipped += names.length - limited.length;
    warnings.push(`Se omitieron ${names.length - limited.length} entradas del zip (máximo ${limits.maxEntries}).`);
  }

  for (const name of limited) {
    if (name.endsWith("/")) continue;
    if (!isSafeEntryName(name)) {
      skipped++;
      warnings.push(`Entrada omitida por nombre no seguro: ${name}`);
      continue;
    }
    const data = entries[name];
    if (!data || data.length === 0) {
      skipped++;
      continue;
    }
    if (data.length > limits.maxFileBytes) {
      skipped++;
      warnings.push(`Archivo demasiado grande (${formatBytes(data.length)}): ${name}`);
      continue;
    }

    const kind = classifyExtension(name);
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const baseAtt: Attachment = {
      id,
      name: `${file.name}/${name}`,
      size: data.length,
      mimeType: kind === "text" ? "text/plain" : "",
      kind,
      origin: "zip",
      parentZipId,
    };

    if (kind === "text") {
      if (isProbablyBinary(data)) {
        skipped++;
        warnings.push(`Binario detectado dentro del zip: ${name}`);
        continue;
      }
      const text = strFromU8(data);
      const truncated = text.length > ATTACHMENT_LIMITS.maxTextChars;
      const clipped = truncated ? text.slice(0, ATTACHMENT_LIMITS.maxTextChars) : text;
      attachments.push({
        ...baseAtt,
        text: clipped,
        truncated,
        bytes: data.length,
        lineCount: clipped.length ? clipped.split("\n").length : 0,
        language: languageFromName(name),
      });
    } else if (kind === "image" || kind === "audio" || kind === "video") {
      attachments.push({
        ...baseAtt,
        text: `[archivo binario ${kind}: ${formatBytes(data.length)}, no se incluye en el contexto textual]`,
        truncated: false,
        bytes: data.length,
      });
    } else {
      skipped++;
    }
  }

  return { parent, attachments, warnings, skipped };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export { readTextFile };
