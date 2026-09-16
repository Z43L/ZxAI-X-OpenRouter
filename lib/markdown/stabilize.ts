/**
 * Prepara Markdown de asistente: delimitadores LaTeX de modelos y
 * cierre suave de fences / $$ mientras el stream aún no ha terminado.
 */

const FENCE_LINE = /^ {0,3}```/;

interface Segment {
  type: "text" | "code";
  value: string;
}

function splitMarkdownFences(src: string): Segment[] {
  const lines = src.split("\n");
  const segments: Segment[] = [];
  let buf: string[] = [];
  let inCode = false;

  const flush = (type: "text" | "code") => {
    if (buf.length === 0) return;
    segments.push({ type, value: buf.join("\n") });
    buf = [];
  };

  for (const line of lines) {
    if (FENCE_LINE.test(line)) {
      if (!inCode) {
        flush("text");
        inCode = true;
        buf.push(line);
      } else {
        buf.push(line);
        flush("code");
        inCode = false;
      }
    } else {
      buf.push(line);
    }
  }
  flush(inCode ? "code" : "text");
  return segments;
}

function joinSegments(segments: Segment[]): string {
  return segments.map((s) => s.value).join("\n");
}

function normalizeLatexInText(text: string): string {
  return (
    text
      // \[...\] → bloque $$ (remark-math solo pone display si $$ está en líneas propias).
      .replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) => `\n$$\n${inner.trim()}\n$$\n`)
      .replace(/\\\[/g, () => "\n$$\n")
      .replace(/\\\]/g, () => "\n$$\n")
      .replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner: string) => `$${inner}$`)
      .replace(/\\\(/g, "$")
      .replace(/\\\)/g, "$")
      // `$$foo$$` en una línea también es display.
      .replace(/\$\$([^\n]+?)\$\$/g, (_m, inner: string) => `\n$$\n${inner.trim()}\n$$\n`)
  );
}

/** Convierte \[ \] y \( \) a $$ / $ fuera de bloques de código. */
export function normalizeLatexDelimiters(src: string): string {
  return joinSegments(
    splitMarkdownFences(src).map((seg) => {
      if (seg.type === "code") return seg;
      return { type: "text" as const, value: normalizeLatexInText(seg.value) };
    }),
  );
}

function oddFenceOpen(src: string): boolean {
  let count = 0;
  for (const line of src.split("\n")) {
    if (FENCE_LINE.test(line)) count += 1;
  }
  return count % 2 === 1;
}

function oddDisplayMath(src: string): boolean {
  let dollars = 0;
  for (const seg of splitMarkdownFences(src)) {
    if (seg.type === "code") continue;
    dollars += seg.value.split("$$").length - 1;
  }
  return dollars % 2 === 1;
}

/**
 * Cierra un fence ` ``` ` o un `$$` impar para que el parser no se trague
 * el resto del mensaje. No intenta cerrar `$` sueltos (precios, etc.).
 */
export function stabilizeStreamingMarkdown(src: string): string {
  let out = src;
  if (oddFenceOpen(out)) {
    out += "\n```";
    return out;
  }
  if (oddDisplayMath(out)) out += "\n$$";
  return out;
}

export function prepareAssistantMarkdown(src: string, streaming: boolean): string {
  const normalized = normalizeLatexDelimiters(src);
  return streaming ? stabilizeStreamingMarkdown(normalized) : normalized;
}
