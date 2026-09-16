"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { Check, Copy } from "lucide-react";
import type { Components } from "react-markdown";
import type { PluggableList } from "unified";
import { cn } from "@/lib/utils/cn";
import { prepareAssistantMarkdown } from "@/lib/markdown/stabilize";

const remarkPlugins: PluggableList = [remarkGfm, remarkMath];
const katexOptions = { throwOnError: false, strict: false as boolean };
const rehypeStreaming: PluggableList = [[rehypeKatex, katexOptions]];
const rehypeComplete: PluggableList = [[rehypeKatex, katexOptions], rehypeHighlight];

/**
 * Extrae texto recursivamente de nodos de React sin convertir objetos a [object Object].
 */
export function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return extractText(props?.children);
  }
  return "";
}

export const CodeBlock = memo(function CodeBlock({
  language,
  rawCode,
  children,
}: {
  language: string;
  rawCode: string;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* portapapeles no disponible */
    }
  };

  return (
    <div className="group/code relative my-3 overflow-hidden rounded-xl border border-zinc-300 bg-zinc-950 shadow-sm dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-[11px] text-zinc-400">
        <span className="font-mono font-medium text-zinc-300">{language || "código"}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Copiar código"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto !bg-zinc-950 !p-3.5 text-[13px] leading-relaxed text-zinc-100 dark:!bg-zinc-950">
        <code className={cn("font-mono hljs", language ? `language-${language}` : undefined)}>
          {children}
        </code>
      </pre>
    </div>
  );
});

export const markdownComponents: Components = {
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const rawText = extractText(children).replace(/\n$/, "");
    const isBlock = !!className || rawText.includes("\n");
    if (!isBlock) {
      return (
        <code className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
          {children}
        </code>
      );
    }
    const match = /language-(\w+)/.exec(className || "");
    return (
      <CodeBlock language={match?.[1] ?? ""} rawCode={rawText}>
        {children}
      </CodeBlock>
    );
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline dark:text-sky-400">
      {children}
    </a>
  ),
};

export interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  isStreaming = false,
  className,
}: MarkdownRendererProps) {
  const markdownSrc = useMemo(
    () => prepareAssistantMarkdown(content, isStreaming),
    [content, isStreaming],
  );

  return (
    <div className={cn("prose prose-zinc max-w-none break-words dark:prose-invert", className)}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={isStreaming ? rehypeStreaming : rehypeComplete}
        components={markdownComponents}
      >
        {markdownSrc}
      </ReactMarkdown>
    </div>
  );
});
