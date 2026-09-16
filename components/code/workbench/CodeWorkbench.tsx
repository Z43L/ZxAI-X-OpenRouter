"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useEditorStore } from "@/store/editor-store";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { ActivityBar } from "./ActivityBar";
import { StatusBar } from "./StatusBar";
import { ResizeHandle } from "./ResizeHandle";
import { CommandPalette } from "./CommandPalette";
import { CodeShortcuts } from "./CodeShortcuts";
import { FileExplorer } from "../explorer/FileExplorer";
import { SearchPanel } from "../search/SearchPanel";
import { ScmPanel } from "../scm/ScmPanel";
import { AgentPanel } from "../ai/AgentPanel";
import { EditorArea } from "../editor/EditorArea";
import { StartScreen } from "../StartScreen";
import { BranchPicker } from "../github/BranchPicker";
import { GitHubConnectModal } from "../github/GitHubConnectModal";
import { RepoPickerModal } from "../github/RepoPickerModal";
import { LocalFolderModal } from "../local/LocalFolderModal";
import { WorkspaceBar } from "./WorkspaceBar";
import { GitHubWorkspaceProvider } from "@/lib/workspace/github/github-provider";
import { getProvider } from "@/lib/workspace/registry";
import { Code, Files, GitBranch, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type MobileCodeTab = "editor" | "explorer" | "ai" | "scm" | "search";

export function CodeWorkbench() {
  const activeId = useWorkspaceStore((s) => s.activeId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activity = useWorkspaceStore((s) => s.activity);
  const leftWidth = useWorkspaceStore((s) => s.leftWidth);
  const rightWidth = useWorkspaceStore((s) => s.rightWidth);
  const rightOpen = useWorkspaceStore((s) => s.rightOpen);
  const setLeftWidth = useWorkspaceStore((s) => s.setLeftWidth);
  const setRightWidth = useWorkspaceStore((s) => s.setRightWidth);
  const conflict = useWorkspaceStore((s) => s.conflict);
  const setConflict = useWorkspaceStore((s) => s.setConflict);
  const meta = workspaces.find((w) => w.id === activeId);

  const isMobile = useIsMobile(768);
  const [mobileTab, setMobileTab] = useState<MobileCodeTab>("editor");

  const activePath = useEditorStore((s) => {
    if (!s.activeWorkspaceId) return null;
    const ws = s.byWorkspace[s.activeWorkspaceId];
    return ws?.groups.find((g) => g.id === ws.activeGroupId)?.activePath ?? null;
  });
  const prevActivePathRef = useRef(activePath);

  useEffect(() => {
    if (isMobile && activePath && activePath !== prevActivePathRef.current) {
      setMobileTab("editor");
    }
    prevActivePathRef.current = activePath;
  }, [activePath, isMobile]);

  if (!activeId || !meta) {
    return (
      <>
        <StartScreen />
        <GitHubConnectModal />
        <RepoPickerModal />
        <LocalFolderModal />
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CodeShortcuts />
      <WorkspaceBar />
      {conflict && (
        <div className="flex items-center gap-3 border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
          <span>
            El remoto ha cambiado. HEAD pasó de {conflict.expected.slice(0, 7)} a {conflict.actual.slice(0, 7)}.
          </span>
          <button
            type="button"
            className="rounded border border-amber-400 px-2 py-0.5"
            onClick={async () => {
              const p = getProvider(activeId);
              if (p instanceof GitHubWorkspaceProvider) await p.reloadRemoteHead();
              setConflict(null);
            }}
          >
            Reload
          </button>
          <button type="button" className="underline" onClick={() => setConflict(null)}>
            Review later
          </button>
        </div>
      )}

      {isMobile ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {mobileTab === "editor" && <EditorArea />}
            {mobileTab === "explorer" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <div className="px-2 pt-2">
                  <BranchPicker />
                </div>
                <FileExplorer />
              </div>
            )}
            {mobileTab === "ai" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <AgentPanel />
              </div>
            )}
            {mobileTab === "scm" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <ScmPanel />
              </div>
            )}
            {mobileTab === "search" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <SearchPanel />
              </div>
            )}
          </div>

          <nav className="flex shrink-0 items-center justify-around border-t border-zinc-200 bg-zinc-50 px-1 py-1 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] dark:border-zinc-800 dark:bg-zinc-900">
            <MobileTabBtn
              active={mobileTab === "editor"}
              onClick={() => setMobileTab("editor")}
              icon={Code}
              label="Editor"
            />
            <MobileTabBtn
              active={mobileTab === "explorer"}
              onClick={() => setMobileTab("explorer")}
              icon={Files}
              label="Archivos"
            />
            <MobileTabBtn
              active={mobileTab === "ai"}
              onClick={() => setMobileTab("ai")}
              icon={Sparkles}
              label="IA"
            />
            <MobileTabBtn
              active={mobileTab === "scm"}
              onClick={() => setMobileTab("scm")}
              icon={GitBranch}
              label="Git"
            />
            <MobileTabBtn
              active={mobileTab === "search"}
              onClick={() => setMobileTab("search")}
              icon={Search}
              label="Buscar"
            />
          </nav>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <ActivityBar />
          <div style={{ width: leftWidth }} className="flex shrink-0 flex-col overflow-hidden border-r border-zinc-200 dark:border-zinc-800">
            {activity === "explorer" && (
              <div className="px-2 pt-2">
                <BranchPicker />
              </div>
            )}
            {activity === "explorer" && <FileExplorer />}
            {activity === "search" && <SearchPanel />}
            {activity === "scm" && <ScmPanel />}
            {activity === "ai" && <div className="p-3 text-xs text-zinc-400">El asistente está en el panel derecho.</div>}
          </div>
          <ResizeHandle direction="horizontal" onDrag={(d) => setLeftWidth(leftWidth + d)} />
          <EditorArea />
          {rightOpen && (
            <>
              <ResizeHandle direction="horizontal" onDrag={(d) => setRightWidth(rightWidth - d)} />
              <div style={{ width: rightWidth }} className="flex min-h-0 shrink-0 flex-col border-l border-zinc-200 dark:border-zinc-800">
                <AgentPanel />
              </div>
            </>
          )}
        </div>
      )}

      {!isMobile && <StatusBar />}
      <CommandPalette />
      <GitHubConnectModal />
      <RepoPickerModal />
      <LocalFolderModal />
    </div>
  );
}

function MobileTabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
        active
          ? "font-semibold text-zinc-900 dark:text-zinc-100"
          : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300",
      )}
    >
      <Icon className={cn("h-4 w-4", active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500")} />
      <span>{label}</span>
    </button>
  );
}
