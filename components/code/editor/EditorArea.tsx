"use client";

import { useEditorStore } from "@/store/editor-store";
import { useCodingAgentStore } from "@/store/coding-agent-store";
import { languageFromPath } from "@/lib/workspace/language";
import { basename } from "@/lib/workspace/path";
import { EditorTabs } from "./EditorTabs";
import { MonacoDiff, MonacoFileEditor } from "./MonacoEditors";
import { cn } from "@/lib/utils/cn";

export function EditorArea() {
  const current = useEditorStore((s) => (s.activeWorkspaceId ? s.byWorkspace[s.activeWorkspaceId] : undefined));
  const setContent = useEditorStore((s) => s.setContent);
  const reviewPath = useCodingAgentStore((s) => s.reviewPath);
  const changeSets = useCodingAgentStore((s) => s.changeSets);
  const activeCs = useCodingAgentStore((s) => s.activeChangeSetId);
  const cs = activeCs ? changeSets[activeCs] : undefined;
  const review = reviewPath ? cs?.files.find((f) => f.path === reviewPath) : undefined;

  if (!current) {
    return <EmptyEditor />;
  }

  const groups = current.split === "single" ? current.groups.slice(0, 1) : current.groups;
  const vertical = current.split !== "horizontal";

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1", vertical ? "flex-row" : "flex-col")}>
      {groups.map((group) => {
        const buf = group.activePath ? current.buffers[group.activePath] : undefined;
        const showDiff = review && group.activePath === review.path;
        return (
          <div key={group.id} className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950">
            <EditorTabs group={group} />
            {showDiff ? (
              <div className="min-h-0 flex-1">
                <MonacoDiff
                  original={review.original ?? ""}
                  modified={review.proposed ?? ""}
                  language={languageFromPath(review.path)}
                />
              </div>
            ) : buf ? (
              <div className="min-h-0 flex-1">
                <MonacoFileEditor
                  path={buf.path}
                  content={buf.content}
                  language={buf.language}
                  onChange={(v) => setContent(buf.path, v)}
                />
              </div>
            ) : (
              <EmptyEditor />
            )}
            {buf && (
              <div className="flex items-center gap-2 border-t border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-400 dark:border-zinc-800">
                <span>{basename(buf.path)}</span>
                <span>Ln {buf.cursor?.line ?? 1}</span>
                <span>Col {buf.cursor?.column ?? 1}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmptyEditor() {
  return (
    <div className="flex flex-1 items-center justify-center bg-white text-sm text-zinc-400 dark:bg-zinc-950">
      Abre un archivo desde el explorador o pulsa ⌘P
    </div>
  );
}
