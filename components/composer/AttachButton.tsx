"use client";

import { useRef } from "react";
import { Paperclip } from "lucide-react";
import { useAttachmentStore } from "@/store/attachment-store";
import { parseAttachments } from "@/lib/attachments";
import { useCapabilityStore } from "@/store/capability-store";

export function AttachButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const setFromResult = useAttachmentStore((s) => s.setFromResult);
  const showToast = useCapabilityStore((s) => s.showToast);

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || (files instanceof FileList && files.length === 0)) return;
    try {
      const result = await parseAttachments(files);
      if (result.attachments.length === 0 && result.warnings.length > 0) {
        showToast("Sin adjuntos", result.warnings[0]);
      }
      setFromResult(result);
      if (result.warnings.length > 0) {
        showToast("Adjuntos", result.warnings[0]);
      }
    } catch (e) {
      showToast("Error al adjuntar", e instanceof Error ? e.message : "Archivo inválido.");
    }
  };

  return (
    <>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        title="Adjuntar archivos"
        aria-label="Adjuntar archivos"
        className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
      >
        <Paperclip className="h-4 w-4" />
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
        className="hidden"
      />
    </>
  );
}
