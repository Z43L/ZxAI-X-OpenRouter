import { create } from "zustand";
import type { AttachmentParseResult, ParsedAttachment } from "@/types/attachments";

interface AttachmentUiState {
  attachments: ParsedAttachment[];
  warnings: string[];
  totalBytes: number;
  setFromResult: (result: AttachmentParseResult) => void;
  clear: () => void;
  remove: (id: string) => void;
}

export const useAttachmentStore = create<AttachmentUiState>()((set) => ({
  attachments: [],
  warnings: [],
  totalBytes: 0,
  setFromResult: (result) =>
    set((s) => {
      const merged = dedupeByName([...s.attachments, ...result.attachments]);
      return {
        attachments: merged,
        warnings: [...s.warnings, ...result.warnings],
        totalBytes: merged.reduce((sum, a) => sum + a.bytes, 0),
      };
    }),
  clear: () => set({ attachments: [], warnings: [], totalBytes: 0 }),
  remove: (id) =>
    set((s) => ({
      attachments: s.attachments.filter((a) => a.id !== id),
      warnings: s.warnings.filter((w) => !w.includes(id)),
    })),
}));

function dedupeByName(list: ParsedAttachment[]): ParsedAttachment[] {
  const seen = new Set<string>();
  const out: ParsedAttachment[] = [];
  for (const a of list) {
    if (seen.has(a.name)) continue;
    seen.add(a.name);
    out.push(a);
  }
  return out;
}
