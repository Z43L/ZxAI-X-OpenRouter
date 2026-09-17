import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { useSettingsStore } from "@/store/settings-store";

export { isNative, platform } from "./native";

export const DEFAULT_NATIVE_OUTPUT_DIR = "ZxAI/Music";

export function getConfiguredOutputDir(): string {
  const settings = useSettingsStore.getState();
  return settings.studio.musicOutputDir?.trim() || DEFAULT_NATIVE_OUTPUT_DIR;
}

export function settingsDataPath(): string {
  return getConfiguredOutputDir();
}

export async function ensureDirectoryExists(path: string): Promise<void> {
  try {
    await Filesystem.mkdir({
      path,
      recursive: true,
      directory: Directory.Documents,
    });
  } catch (e) {
    if (!isExistsError(e)) throw e;
  }
}

function isExistsError(e: unknown): boolean {
  if (!e) return false;
  const code = (e as { code?: string }).code ?? "";
  const message = (e as { message?: string }).message ?? "";
  return /exists|already/i.test(code) || /exists|already/i.test(message);
}

export async function saveBytesNative(
  bytes: Uint8Array,
  filename: string,
  _mimeType: string,
  overrideFullPath?: string,
): Promise<string> {
  const dir = overrideFullPath
    ? overrideFullPath.slice(0, overrideFullPath.lastIndexOf("/"))
    : getConfiguredOutputDir();
  await ensureDirectoryExists(dir);
  const cleanName = overrideFullPath?.includes("/")
    ? overrideFullPath.slice(overrideFullPath.lastIndexOf("/") + 1)
    : filename;
  const b64 = bytesToBase64(bytes);
  const fullPath = `${dir}/${cleanName}`;
  const result = await Filesystem.writeFile({
    path: fullPath,
    data: b64,
    directory: Directory.Documents,
    recursive: true,
  });
  return result.uri ?? fullPath;
}

export async function writeTextNative(text: string, path: string): Promise<string> {
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  if (dir) await ensureDirectoryExists(dir);
  const result = await Filesystem.writeFile({
    path,
    data: text,
    directory: Directory.Documents,
    recursive: true,
    encoding: Encoding.UTF8,
  });
  return result.uri ?? path;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

export function getPlatform(): string {
  return Capacitor.getPlatform();
}
