export interface LineHunk {
  id: string;
  oldStart: number;
  oldLines: string[];
  newStart: number;
  newLines: string[];
}

export function countLineDelta(original: string | null, proposed: string | null): { insertions: number; deletions: number } {
  const a = original?.split("\n") ?? [];
  const b = proposed?.split("\n") ?? [];
  if (original == null) return { insertions: b.length, deletions: 0 };
  if (proposed == null) return { insertions: 0, deletions: a.length };
  let insertions = 0;
  let deletions = 0;
  const mb = new Map<string, number>();
  for (const line of b) mb.set(line, (mb.get(line) ?? 0) + 1);
  for (const line of a) {
    const n = mb.get(line) ?? 0;
    if (n <= 0) deletions++;
    else mb.set(line, n - 1);
  }
  for (const n of mb.values()) insertions += n;
  return { insertions, deletions };
}

/** Aplica un unified diff mínimo sobre `original`. */
export function applyUnifiedPatch(original: string, patch: string): string {
  const lines = original.split("\n");
  const hunks = parseHunks(patch);
  if (hunks.length === 0) {
    throw new Error("El parche no contiene hunks válidos.");
  }
  let offset = 0;
  for (const h of hunks) {
    const start = h.oldStart - 1 + offset;
    const oldBlock = lines.slice(start, start + h.oldLines.length);
    if (oldBlock.join("\n") !== h.oldLines.join("\n")) {
      // intento de localizar el contexto
      const idx = findBlock(lines, h.oldLines);
      if (idx < 0) throw new Error("El parche no encaja con el archivo actual.");
      lines.splice(idx, h.oldLines.length, ...h.newLines);
      offset += h.newLines.length - h.oldLines.length;
      continue;
    }
    lines.splice(start, h.oldLines.length, ...h.newLines);
    offset += h.newLines.length - h.oldLines.length;
  }
  return lines.join("\n");
}

function findBlock(haystack: string[], needle: string[]): number {
  if (needle.length === 0) return 0;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function parseHunks(patch: string): { oldStart: number; oldLines: string[]; newLines: string[] }[] {
  const hunks: { oldStart: number; oldLines: string[]; newLines: string[] }[] = [];
  const raw = patch.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < raw.length) {
    const line = raw[i];
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (!m) {
      i++;
      continue;
    }
    const oldStart = Number(m[1]);
    i++;
    const oldLines: string[] = [];
    const newLines: string[] = [];
    while (i < raw.length && !raw[i].startsWith("@@") && !raw[i].startsWith("diff ")) {
      const l = raw[i];
      if (l.startsWith("---") || l.startsWith("+++")) {
        i++;
        continue;
      }
      if (l.startsWith("\\")) {
        i++;
        continue;
      }
      if (l.startsWith("-")) oldLines.push(l.slice(1));
      else if (l.startsWith("+")) newLines.push(l.slice(1));
      else if (l.startsWith(" ")) {
        oldLines.push(l.slice(1));
        newLines.push(l.slice(1));
      } else if (l === "") {
        oldLines.push("");
        newLines.push("");
      }
      i++;
    }
    hunks.push({ oldStart, oldLines, newLines });
  }
  return hunks;
}
