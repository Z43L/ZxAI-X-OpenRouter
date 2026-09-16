"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  FilePlus,
  FolderPlus,
  FolderOpen,
  FolderX,
  RefreshCw,
  ChevronsDownUp,
  File as FileIcon,
  Folder,
} from "lucide-react";
import type { WorkspaceEntry } from "@/types/workspace";
import { getProvider } from "@/lib/workspace/registry";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useEditorStore } from "@/store/editor-store";
import { basename, dirname, joinPath } from "@/lib/workspace/path";
import { cn } from "@/lib/utils/cn";

export function FileExplorer() {
  const workspaceId = useWorkspaceStore((s) => s.activeId);
  const meta = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === s.activeId));
  const editor = useEditorStore((s) => (s.activeWorkspaceId ? s.byWorkspace[s.activeWorkspaceId] : undefined));
  const toggleExpanded = useEditorStore((s) => s.toggleExpanded);
  const openFile = useEditorStore((s) => s.openFile);
  const [tree, setTree] = useState<Record<string, WorkspaceEntry[]>>({});
  const [menu, setMenu] = useState<{ x: number; y: number; path: string; type: "file" | "directory" | "root" } | null>(null);
  const [creating, setCreating] = useState<{ parent: string; kind: "file" | "directory" } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const editorExpanded = editor?.expanded;
  const expanded = editorExpanded ?? new Set<string>([""]);

  const loadDir = useCallback(async (path: string) => {
    const provider = getProvider(workspaceId);
    if (!provider) return;
    const entries = await provider.listDirectory(path);
    setTree((t) => ({ ...t, [path]: entries }));
  }, [workspaceId]);

  const refresh = useCallback(async () => {
    const provider = getProvider(workspaceId);
    if (!provider) return;
    const expanded = useEditorStore.getState().current()?.expanded ?? new Set([""]);
    const next: Record<string, WorkspaceEntry[]> = {};
    for (const p of expanded) {
      try {
        next[p] = await provider.listDirectory(p);
      } catch {
        /* ignore */
      }
    }
    setTree(next);
  }, [workspaceId]);

  useEffect(() => {
    const provider = getProvider(workspaceId);
    if (!provider) return;
    const unsub = provider.onDidChange(() => {
      void refresh();
    });
    const t = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      window.clearTimeout(t);
      unsub();
    };
  }, [workspaceId, refresh]);

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="flex items-center gap-1 border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
          {meta?.name ?? "Explorer"}
        </span>
        <IconBtn
          title="Abrir carpeta"
          onClick={() =>
            void useWorkspaceStore
              .getState()
              .openLocalFolder()
              .catch((e) => alert(e instanceof Error ? e.message : String(e)))
          }
        >
          <FolderOpen className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn
          title="Cerrar carpeta"
          onClick={() => {
            if (workspaceId) void useWorkspaceStore.getState().closeWorkspace(workspaceId);
          }}
        >
          <FolderX className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn title="Nuevo archivo" onClick={() => setCreating({ parent: "", kind: "file" })}>
          <FilePlus className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn title="Nueva carpeta" onClick={() => setCreating({ parent: "", kind: "directory" })}>
          <FolderPlus className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn title="Refrescar" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn title="Contraer todo" onClick={() => useEditorStore.setState((s) => {
          const id = s.activeWorkspaceId;
          if (!id || !s.byWorkspace[id]) return s;
          return { byWorkspace: { ...s.byWorkspace, [id]: { ...s.byWorkspace[id], expanded: new Set([""]) } } };
        })}>
          <ChevronsDownUp className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
      <div
        className="flex-1 overflow-auto py-1"
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, path: "", type: "root" });
        }}
      >
        {creating?.parent === "" && (
          <InlineName
            kind={creating.kind}
            onCancel={() => setCreating(null)}
            onSubmit={async (name) => {
              await createEntry("", creating.kind, name);
              setCreating(null);
              refresh();
            }}
          />
        )}
        <Tree
          path=""
          tree={tree}
          expanded={expanded}
          renaming={renaming}
          creating={creating}
          onToggle={(p) => {
            toggleExpanded(p);
            void loadDir(p);
          }}
          onOpen={(p) => void openFile(p)}
          onMenu={setMenu}
          onRenameDone={() => {
            setRenaming(null);
            refresh();
          }}
          onCreateDone={() => {
            setCreating(null);
            refresh();
          }}
        />
      </div>
      {menu && (
        <ExplorerMenu
          {...menu}
          onClose={() => setMenu(null)}
          onAction={async (action) => {
            if (action === "open-folder") {
              await useWorkspaceStore
                .getState()
                .openLocalFolder()
                .catch((e) => alert(e instanceof Error ? e.message : String(e)));
              setMenu(null);
              return;
            }
            if (action === "close-folder") {
              if (workspaceId) await useWorkspaceStore.getState().closeWorkspace(workspaceId);
              setMenu(null);
              return;
            }
            const provider = getProvider(workspaceId);
            if (!provider) return;
            const target = menu.path;
            if (action === "new-file") setCreating({ parent: menu.type === "file" ? dirname(target) : target, kind: "file" });
            if (action === "new-folder") setCreating({ parent: menu.type === "file" ? dirname(target) : target, kind: "directory" });
            if (action === "open") await openFile(target);
            if (action === "open-side") await openFile(target, { toSide: true });
            if (action === "rename") setRenaming(target);
            if (action === "delete" && target && window.confirm(`¿Borrar ${basename(target)}?`)) {
              await provider.delete(target);
              refresh();
            }
            if (action === "duplicate" && menu.type === "file") {
              const file = await provider.readFile(target);
              const dest = uniqueCopyName(target);
              await provider.createFile(dest, file.text);
              refresh();
            }
            if (action === "copy-path") await navigator.clipboard.writeText(target);
            if (action === "copy-rel") await navigator.clipboard.writeText(target);
            if (action === "ask-ai") {
              useWorkspaceStore.getState().setRightOpen(true);
              useWorkspaceStore.getState().setActivity("ai");
            }
            if (action === "refresh") refresh();
            setMenu(null);
          }}
        />
      )}
    </div>
  );
}

function Tree({
  path,
  tree,
  expanded,
  renaming,
  creating,
  depth = 0,
  onToggle,
  onOpen,
  onMenu,
  onRenameDone,
  onCreateDone,
}: {
  path: string;
  tree: Record<string, WorkspaceEntry[]>;
  expanded: Set<string>;
  renaming: string | null;
  creating: { parent: string; kind: "file" | "directory" } | null;
  depth?: number;
  onToggle: (p: string) => void;
  onOpen: (p: string) => void;
  onMenu: (m: { x: number; y: number; path: string; type: "file" | "directory" | "root" }) => void;
  onRenameDone: () => void;
  onCreateDone: () => void;
}) {
  const entries = tree[path] ?? [];
  return (
    <ul>
      {creating?.parent === path && path !== "" && (
        <li>
          <InlineName
            kind={creating.kind}
            depth={depth}
            onCancel={onCreateDone}
            onSubmit={async (name) => {
              await createEntry(path, creating.kind, name);
              onCreateDone();
            }}
          />
        </li>
      )}
      {entries.map((e) => {
        const open = expanded.has(e.path);
        return (
          <li key={e.path}>
            {renaming === e.path ? (
              <InlineName
                kind={e.type}
                depth={depth}
                initial={e.name}
                onCancel={onRenameDone}
                onSubmit={async (name) => {
                  const provider = getProvider(useWorkspaceStore.getState().activeId);
                  if (!provider) return;
                  const dest = path ? joinPath(path, name) : name;
                  await provider.rename(e.path, dest);
                  onRenameDone();
                }}
              />
            ) : (
              <button
                type="button"
                style={{ paddingLeft: 8 + depth * 12 }}
                className="flex w-full items-center gap-1 py-[3px] pr-2 text-left text-[13px] text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => (e.type === "directory" ? onToggle(e.path) : onOpen(e.path))}
                onDoubleClick={() => e.type === "file" && onOpen(e.path)}
                onContextMenu={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  onMenu({ x: ev.clientX, y: ev.clientY, path: e.path, type: e.type });
                }}
                draggable={e.type === "file"}
                onDragStart={(ev) => ev.dataTransfer.setData("text/chatai-path", e.path)}
                onDragOver={(ev) => {
                  if (e.type === "directory") ev.preventDefault();
                }}
                onDrop={async (ev) => {
                  ev.preventDefault();
                  const from = ev.dataTransfer.getData("text/chatai-path");
                  if (!from || e.type !== "directory") return;
                  const provider = getProvider(useWorkspaceStore.getState().activeId);
                  if (!provider) return;
                  await provider.move(from, joinPath(e.path, basename(from)));
                  onRenameDone();
                }}
              >
                {e.type === "directory" ? (
                  <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform", open && "rotate-90")} />
                ) : (
                  <span className="w-3.5" />
                )}
                {e.type === "directory" ? (
                  <Folder className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                ) : (
                  <FileIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                )}
                <span className="truncate">{e.name}</span>
              </button>
            )}
            {e.type === "directory" && open && (
              <Tree
                path={e.path}
                tree={tree}
                expanded={expanded}
                renaming={renaming}
                creating={creating}
                depth={depth + 1}
                onToggle={onToggle}
                onOpen={onOpen}
                onMenu={onMenu}
                onRenameDone={onRenameDone}
                onCreateDone={onCreateDone}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function InlineName({
  kind,
  depth = 0,
  initial = "",
  onSubmit,
  onCancel,
}: {
  kind: "file" | "directory";
  depth?: number;
  initial?: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <form
      style={{ paddingLeft: 8 + depth * 12 }}
      className="px-1 py-0.5"
      onSubmit={(e) => {
        e.preventDefault();
        const name = v.trim();
        if (!name) return onCancel();
        void onSubmit(name);
      }}
    >
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onCancel()}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        placeholder={kind === "file" ? "archivo.ts" : "carpeta"}
        className="w-full rounded border border-zinc-300 bg-white px-1 py-0.5 text-[13px] outline-none dark:border-zinc-600 dark:bg-zinc-900"
      />
    </form>
  );
}

function ExplorerMenu({
  x,
  y,
  onClose,
  onAction,
  type,
}: {
  x: number;
  y: number;
  path: string;
  type: "file" | "directory" | "root";
  onClose: () => void;
  onAction: (a: string) => void;
}) {
  const items = useMemo(() => {
    const workspaceItems: string[][] = [
      ["open-folder", "Abrir carpeta…"],
      ["close-folder", "Cerrar carpeta"],
    ];
    const fileItems: string[][] = [
      ["new-file", "Nuevo archivo"],
      ["new-folder", "Nueva carpeta"],
      ["sep"],
      ["open", "Abrir"],
      ["open-side", "Abrir al lado"],
      ["sep"],
      ["rename", "Renombrar"],
      ["duplicate", "Duplicar"],
      ["delete", "Eliminar"],
      ["sep"],
      ["copy-path", "Copiar ruta"],
      ["copy-rel", "Copiar ruta relativa"],
      ["sep"],
      ["ask-ai", "Preguntar a la IA"],
      ["refresh", "Refrescar"],
    ];
    return type === "root" ? [...workspaceItems, ["sep"], ...fileItems] : [...fileItems, ["sep"], ...workspaceItems];
  }, [type]);
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [onClose]);
  return (
    <ul
      style={{ left: x, top: y }}
      className="fixed z-[80] min-w-[200px] rounded-lg border border-zinc-200 bg-white py-1 text-[13px] shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      {items.map((it, i) =>
        it[0] === "sep" ? (
          <li key={i} className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
        ) : (
          <li key={it[0]}>
            <button
              type="button"
              className="w-full px-3 py-1 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={(e) => {
                e.stopPropagation();
                onAction(it[0]!);
              }}
            >
              {it[1]}
            </button>
          </li>
        ),
      )}
    </ul>
  );
}

function IconBtn({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800"
      {...props}
    >
      {children}
    </button>
  );
}

async function createEntry(parent: string, kind: "file" | "directory", name: string) {
  const provider = getProvider(useWorkspaceStore.getState().activeId);
  if (!provider) return;
  const path = parent ? joinPath(parent, name) : name;
  if (kind === "directory") await provider.createDirectory(path);
  else await provider.createFile(path, "");
}

function uniqueCopyName(path: string) {
  const i = path.lastIndexOf(".");
  if (i <= 0) return `${path}.copy`;
  return `${path.slice(0, i)}.copy${path.slice(i)}`;
}
