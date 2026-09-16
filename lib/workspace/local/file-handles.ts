import { splitPath } from "../path";

export async function resolveDirectory(
  root: FileSystemDirectoryHandle,
  path: string,
  create = false,
): Promise<FileSystemDirectoryHandle> {
  const parts = splitPath(path);
  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create });
  }
  return dir;
}

export async function resolveFile(
  root: FileSystemDirectoryHandle,
  path: string,
  create = false,
): Promise<FileSystemFileHandle> {
  const parts = splitPath(path);
  if (parts.length === 0) throw new Error("Ruta de archivo vacía.");
  const name = parts.pop()!;
  const dir = await resolveDirectory(root, parts.join("/"), create);
  return dir.getFileHandle(name, { create });
}

export async function pathExists(root: FileSystemDirectoryHandle, path: string): Promise<boolean> {
  if (!path) return true;
  const parts = splitPath(path);
  let dir = root;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const last = i === parts.length - 1;
    try {
      dir = await dir.getDirectoryHandle(part);
    } catch {
      if (!last) return false;
      try {
        await dir.getFileHandle(part);
        return true;
      } catch {
        return false;
      }
    }
  }
  return true;
}

export async function removeEntry(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<void> {
  const parts = splitPath(path);
  if (parts.length === 0) throw new Error("No se puede borrar la raíz del workspace.");
  const name = parts.pop()!;
  const dir = await resolveDirectory(root, parts.join("/"));
  await dir.removeEntry(name, { recursive: true });
}

export async function readFileText(handle: FileSystemFileHandle): Promise<{ text: string; size: number; lastModified?: number }> {
  const file = await handle.getFile();
  const buf = new Uint8Array(await file.arrayBuffer());
  const { looksBinary } = await import("../language");
  if (looksBinary(buf)) {
    throw new Error("Archivo binario: no se puede editar como texto.");
  }
  return { text: new TextDecoder("utf-8", { fatal: false }).decode(buf), size: file.size, lastModified: file.lastModified };
}

export async function writeFileText(handle: FileSystemFileHandle, content: string): Promise<void> {
  const writable = await handle.createWritable({ keepExistingData: false });
  try {
    await writable.write(content);
    await writable.close();
  } catch (err) {
    try {
      await writable.abort();
    } catch {
      /* ignore */
    }
    throw err;
  }
}
