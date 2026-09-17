/**
 * Helpers para descargar o escribir bytes en disco.
 * - En navegador: usa anchor + Blob (descarga estándar).
 * - En nativo (Capacitor): usa @capacitor/filesystem.
 */

import { isNative, saveBytesNative, settingsDataPath } from "@/lib/mobile/fs";
import { useSettingsStore } from "@/store/settings-store";

export async function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
  overrideDir?: string,
): Promise<{ ok: boolean; savedTo?: string }> {
  if (isNative) {
    const settings = useSettingsStore.getState();
    const baseDir = overrideDir ?? (settings.studio.musicOutputDir || "ZxAI/Music");
    const fullPath = baseDir.endsWith("/") ? `${baseDir}${filename}` : `${baseDir}/${filename}`;
    const saved = await saveBytesNative(bytes, filename, mimeType, fullPath);
    return { ok: true, savedTo: saved };
  }
  const buf = new Uint8Array(bytes).buffer.slice(0) as ArrayBuffer;
  const blob = new Blob([buf], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true };
}

export async function downloadBlob(blob: Blob, filename: string): Promise<{ ok: boolean; savedTo?: string }> {
  if (isNative) {
    const arr = new Uint8Array(await blob.arrayBuffer());
    const saved = await saveBytesNative(arr, filename, blob.type || "application/octet-stream");
    return { ok: true, savedTo: saved };
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true };
}

export { isNative, settingsDataPath };
