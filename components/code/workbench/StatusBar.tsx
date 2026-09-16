"use client";

import { useEditorStore } from "@/store/editor-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { languageFromPath } from "@/lib/workspace/language";
import { BranchPicker } from "../github/BranchPicker";

export function StatusBar() {
  const meta = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId));
  const editor = useEditorStore((s) => (s.activeWorkspaceId ? s.byWorkspace[s.activeWorkspaceId] : undefined));
  const saveError = useEditorStore((s) => s.saveError);
  const group = editor?.groups.find((g) => g.id === editor.activeGroupId);
  const buf = group?.activePath ? editor?.buffers[group.activePath] : undefined;
  const dirty = buf?.dirty;
  const saving = buf?.saving;

  let saveLabel = "✓ Saved";
  if (meta?.type === "github") saveLabel = dirty ? "● Buffer local" : "✓ Buffer limpio";
  else if (saving) saveLabel = "Saving…";
  else if (dirty) saveLabel = "● Unsaved";

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-zinc-200 bg-zinc-50 px-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="truncate">{buf ? buf.path.split("/").pop() : meta?.name ?? "Code"}</span>
      <span>UTF-8</span>
      {buf && <span className="capitalize">{languageFromPath(buf.path)}</span>}
      {buf?.cursor && (
        <span>
          Ln {buf.cursor.line} Col {buf.cursor.column}
        </span>
      )}
      {meta?.type === "github" && <BranchPicker />}
      {meta?.type === "local" && <span>Local</span>}
      <span className={dirty ? "text-amber-600" : "text-emerald-600"}>{saveLabel}</span>
      {saveError && <span className="truncate text-red-500">{saveError}</span>}
      <span className="ml-auto">OpenRouter</span>
    </footer>
  );
}
