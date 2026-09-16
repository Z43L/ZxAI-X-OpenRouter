import ignore, { type Ignore } from "ignore";

export const DEFAULT_IGNORE = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  ".turbo/",
  "coverage/",
  "out/",
  ".cache/",
  "*.min.js",
  "*.map",
  ".DS_Store",
  "Thumbs.db",
  ".chatai/",
].join("\n");

export const EXPLORER_HIDDEN = new Set(["node_modules", ".git", ".next", "dist", "build", ".turbo"]);

export function createIgnoreMatcher(extra: string[] = []): Ignore {
  const ig = ignore();
  ig.add(DEFAULT_IGNORE);
  for (const block of extra) {
    if (block.trim()) ig.add(block);
  }
  return ig;
}

export function isIgnored(ig: Ignore, path: string, isDirectory = false): boolean {
  const p = path.replace(/^\/+/, "");
  if (!p) return false;
  return ig.ignores(isDirectory && !p.endsWith("/") ? `${p}/` : p);
}

export function hideInExplorer(name: string): boolean {
  return EXPLORER_HIDDEN.has(name);
}

export function parseGlobToRegExp(pattern: string): RegExp | null {
  const raw = pattern.trim();
  if (!raw) return null;
  const escaped = raw
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/{{GLOBSTAR}}/g, ".*")
    .replace(/\?/g, "[^/]");
  try {
    return new RegExp(`^${escaped}$`);
  } catch {
    return null;
  }
}

export function matchesGlobList(path: string, list?: string): boolean {
  if (!list?.trim()) return true;
  const parts = list.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return true;
  return parts.some((g) => {
    const re = parseGlobToRegExp(g);
    if (!re) return path.includes(g.replace(/\*/g, ""));
    return re.test(path) || re.test(path.split("/").pop() ?? "");
  });
}
