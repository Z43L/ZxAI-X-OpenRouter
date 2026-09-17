"use client";

import { FileText, FileArchive, Image as ImageIcon, Music, Video, X } from "lucide-react";
import { useAttachmentStore } from "@/store/attachment-store";
import type { ParsedAttachment } from "@/types/attachments";
import { cn } from "@/lib/utils/cn";

function iconFor(kind: ParsedAttachment["kind"]) {
  switch (kind) {
    case "text":
      return FileText;
    case "image":
      return ImageIcon;
    case "audio":
      return Music;
    case "video":
      return Video;
    case "zip":
      return FileArchive;
    default:
      return FileText;
  }
}

function IconByKind({ kind }: { kind: ParsedAttachment["kind"] }) {
  const I = iconFor(kind);
  return <I className="h-3 w-3 shrink-0 text-zinc-500 dark:text-zinc-400" />;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentChip({ attachment }: { attachment: ParsedAttachment }) {
  const remove = useAttachmentStore((s) => s.remove);
  return (
    <span
      className={cn(
        "inline-flex max-w-[200px] items-center gap-1 rounded-full border border-zinc-200 bg-white py-0.5 pr-0.5 pl-1.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
      )}
      title={`${attachment.name} (${formatBytes(attachment.bytes)})`}
    >
      <IconByKind kind={attachment.kind} />
      <span className="min-w-0 truncate">{attachment.name.split("/").pop()}</span>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => remove(attachment.id)}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
        aria-label={`Quitar ${attachment.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function AttachmentPreview() {
  const attachments = useAttachmentStore((s) => s.attachments);
  const clear = useAttachmentStore((s) => s.clear);
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-200/80 px-3 pt-2 pb-1.5 dark:border-zinc-700/80">
      <span className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
        Adjuntos ({attachments.length})
      </span>
      <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto">
        {attachments.map((a) => (
          <AttachmentChip key={a.id} attachment={a} />
        ))}
      </div>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={clear}
        className="ml-auto text-[10px] font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
      >
        Limpiar
      </button>
    </div>
  );
}
