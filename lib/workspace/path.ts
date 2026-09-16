const SENSITIVE_SEGMENTS = new Set([".."]);

/** Normaliza a ruta posix relativa al root del workspace, sin slash inicial. */
export function normalizePath(input: string): string {
  const raw = (input ?? "").replace(/\\/g, "/").trim();
  const noLead = raw.replace(/^\/+/, "");
  const parts: string[] = [];
  for (const part of noLead.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) {
        throw new Error("Ruta inválida: no se puede salir del workspace.");
      }
      parts.pop();
      continue;
    }
    if (SENSITIVE_SEGMENTS.has(part)) {
      throw new Error("Ruta inválida.");
    }
    parts.push(part);
  }
  return parts.join("/");
}

export function assertSafePath(input: string): string {
  return normalizePath(input);
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter(Boolean).join("/"));
}

export function dirname(path: string): string {
  const n = normalizePath(path);
  const i = n.lastIndexOf("/");
  return i <= 0 ? "" : n.slice(0, i);
}

export function basename(path: string): string {
  const n = normalizePath(path);
  const i = n.lastIndexOf("/");
  return i < 0 ? n : n.slice(i + 1);
}

export function extname(path: string): string {
  const name = basename(path);
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i) : "";
}

export function isPathInside(parent: string, child: string): boolean {
  const p = normalizePath(parent);
  const c = normalizePath(child);
  if (!p) return true;
  return c === p || c.startsWith(`${p}/`);
}

export function splitPath(path: string): string[] {
  const n = normalizePath(path);
  return n ? n.split("/") : [];
}
