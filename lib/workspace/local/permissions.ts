export function hasDirectoryPicker(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function queryHandlePermission(
  handle: FileSystemHandle | undefined | null,
  mode: FileSystemPermissionMode = "readwrite",
): Promise<PermissionState> {
  if (!handle || typeof handle.queryPermission !== "function") return "granted";
  try {
    return await handle.queryPermission({ mode });
  } catch {
    return "prompt";
  }
}

export async function ensureHandlePermission(
  handle: FileSystemHandle | undefined | null,
  mode: FileSystemPermissionMode = "readwrite",
): Promise<PermissionState> {
  if (!handle) return "granted";
  const current = await queryHandlePermission(handle, mode);
  if (current === "granted") return current;
  if (typeof handle.requestPermission !== "function") return current;
  try {
    return await handle.requestPermission({ mode });
  } catch {
    return "denied";
  }
}
