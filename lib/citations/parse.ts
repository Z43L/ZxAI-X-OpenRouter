import type { Citation } from "@/types/capabilities";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function citationFromUnknown(raw: unknown): Citation | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const nested = asRecord(rec.url_citation);
  const src = nested ?? rec;
  const url = typeof src.url === "string" ? src.url : typeof rec.url === "string" ? rec.url : "";
  if (!url) return null;
  const type = rec.type;
  if (type && type !== "url_citation") return null;
  return {
    url,
    title: typeof src.title === "string" ? src.title : undefined,
    content: typeof src.content === "string" ? src.content : undefined,
    startIndex: typeof src.start_index === "number" ? src.start_index : undefined,
    endIndex: typeof src.end_index === "number" ? src.end_index : undefined,
  };
}

export function citationsFromAnnotations(annotations: unknown[] | undefined | null): Citation[] {
  if (!annotations?.length) return [];
  const out: Citation[] = [];
  for (const item of annotations) {
    const parsed = citationFromUnknown(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function mergeCitations(existing: Citation[], incoming: Citation[]): Citation[] {
  if (incoming.length === 0) return existing;
  const out = [...existing];
  const seen = new Set(existing.map((c) => c.url));
  for (const c of incoming) {
    if (seen.has(c.url)) {
      const i = out.findIndex((x) => x.url === c.url);
      if (i >= 0) {
        out[i] = {
          ...out[i],
          title: c.title || out[i].title,
          content: c.content || out[i].content,
          startIndex: out[i].startIndex ?? c.startIndex,
          endIndex: out[i].endIndex ?? c.endIndex,
        };
      }
      continue;
    }
    seen.add(c.url);
    out.push(c);
  }
  return out;
}

export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
