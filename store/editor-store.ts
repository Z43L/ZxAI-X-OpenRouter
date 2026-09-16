import { create } from "zustand";
import type { EditorBuffer, EditorGroup, ExplorerClipboard, OpenTab, SplitLayout } from "@/types/code";
import { getProvider } from "@/lib/workspace/registry";
import { languageFromPath } from "@/lib/workspace/language";
import { newId } from "@/lib/utils/ids";
import { useSettingsStore } from "./settings-store";

interface WorkspaceEditorState {
  groups: EditorGroup[];
  activeGroupId: string;
  split: SplitLayout;
  buffers: Record<string, EditorBuffer>;
  clipboard: ExplorerClipboard | null;
  expanded: Set<string>;
  searchQuery: string;
  searchCase: boolean;
  searchRegex: boolean;
  searchWord: boolean;
  searchInclude: string;
  searchExclude: string;
}

function emptyWorkspace(): WorkspaceEditorState {
  const gid = newId();
  return {
    groups: [{ id: gid, tabs: [], activePath: null }],
    activeGroupId: gid,
    split: "single",
    buffers: {},
    clipboard: null,
    expanded: new Set([""]),
    searchQuery: "",
    searchCase: false,
    searchRegex: false,
    searchWord: false,
    searchInclude: "",
    searchExclude: "",
  };
}

interface EditorState {
  byWorkspace: Record<string, WorkspaceEditorState>;
  activeWorkspaceId: string | null;
  saveError: string | null;
  resetWorkspace: (id: string) => void;
  activateWorkspace: (id: string) => void;
  disposeWorkspace: (id: string) => void;
  current: () => WorkspaceEditorState | undefined;
  openFile: (path: string, opts?: { preview?: boolean; toSide?: boolean }) => Promise<void>;
  closeTab: (groupId: string, path: string) => void;
  pinTab: (groupId: string, path: string) => void;
  setActiveTab: (groupId: string, path: string) => void;
  setContent: (path: string, content: string) => void;
  save: (path: string) => Promise<void>;
  saveAll: (workspaceId?: string) => Promise<void>;
  setSelection: (path: string, sel: EditorBuffer["selection"], cursor?: EditorBuffer["cursor"]) => void;
  toggleSplit: (layout: SplitLayout) => void;
  setClipboard: (clip: ExplorerClipboard | null) => void;
  toggleExpanded: (path: string) => void;
  setSearch: (p: Partial<Pick<WorkspaceEditorState, "searchQuery" | "searchCase" | "searchRegex" | "searchWord" | "searchInclude" | "searchExclude">>) => void;
  markSaved: (path: string, content: string) => void;
}

const saveTimers = new Map<string, number>();

function wsKey(workspaceId: string, path: string) {
  return `${workspaceId}::${path}`;
}

export const useEditorStore = create<EditorState>()((set, get) => {
  function mutate(workspaceId: string, fn: (w: WorkspaceEditorState) => WorkspaceEditorState) {
    set((s) => {
      const cur = s.byWorkspace[workspaceId] ?? emptyWorkspace();
      return { byWorkspace: { ...s.byWorkspace, [workspaceId]: fn(cur) } };
    });
  }

  function scheduleSave(workspaceId: string, path: string) {
    const settings = useSettingsStore.getState().code ?? { autoSave: "afterDelay" as const, autoSaveDelayMs: 750 };
    if (settings.autoSave !== "afterDelay") return;
    const key = wsKey(workspaceId, path);
    const prev = saveTimers.get(key);
    if (prev) window.clearTimeout(prev);
    const t = window.setTimeout(() => {
      void get().save(path);
    }, settings.autoSaveDelayMs);
    saveTimers.set(key, t);
  }

  return {
    byWorkspace: {},
    activeWorkspaceId: null,
    saveError: null,

    resetWorkspace: (id) =>
      set((s) => ({
        byWorkspace: { ...s.byWorkspace, [id]: s.byWorkspace[id] ?? emptyWorkspace() },
        activeWorkspaceId: id,
      })),

    activateWorkspace: (id) =>
      set((s) => ({
        activeWorkspaceId: id,
        byWorkspace: { ...s.byWorkspace, [id]: s.byWorkspace[id] ?? emptyWorkspace() },
      })),

    disposeWorkspace: (id) =>
      set((s) => {
        const next = { ...s.byWorkspace };
        delete next[id];
        return {
          byWorkspace: next,
          activeWorkspaceId: s.activeWorkspaceId === id ? null : s.activeWorkspaceId,
        };
      }),

    current: () => {
      const id = get().activeWorkspaceId;
      return id ? get().byWorkspace[id] : undefined;
    },

    openFile: async (path, opts) => {
      const workspaceId = get().activeWorkspaceId;
      if (!workspaceId) return;
      const provider = getProvider(workspaceId);
      if (!provider) return;
      const file = await provider.readFile(path);
      mutate(workspaceId, (w) => {
        const buffers = {
          ...w.buffers,
          [path]: w.buffers[path] ?? {
            path,
            content: file.text,
            savedContent: file.text,
            dirty: false,
            saving: false,
            language: file.language ?? languageFromPath(path),
            encoding: "utf-8" as const,
          },
        };
        let groups = w.groups;
        let activeGroupId = w.activeGroupId;
        if (opts?.toSide) {
          if (groups.length < 2) {
            const gid = newId();
            groups = [...groups, { id: gid, tabs: [], activePath: null }];
            activeGroupId = gid;
          } else {
            activeGroupId = groups.find((g) => g.id !== w.activeGroupId)?.id ?? w.activeGroupId;
          }
        }
        groups = groups.map((g) => {
          if (g.id !== activeGroupId) return g;
          const exists = g.tabs.find((t) => t.path === path);
          const tab: OpenTab = { path, pinned: exists?.pinned ?? false, preview: opts?.preview && !exists?.pinned };
          const tabs = exists
            ? g.tabs.map((t) => (t.path === path ? tab : t))
            : tab.preview
              ? [...g.tabs.filter((t) => !t.preview), tab]
              : [...g.tabs.filter((t) => !t.preview || t.pinned), tab];
          return { ...g, tabs, activePath: path };
        });
        return { ...w, buffers, groups, activeGroupId, split: groups.length > 1 ? w.split === "single" ? "vertical" : w.split : "single" };
      });
    },

    closeTab: (groupId, path) => {
      const workspaceId = get().activeWorkspaceId;
      if (!workspaceId) return;
      mutate(workspaceId, (w) => ({
        ...w,
        groups: w.groups.map((g) => {
          if (g.id !== groupId) return g;
          const tabs = g.tabs.filter((t) => t.path !== path);
          const activePath = g.activePath === path ? (tabs[tabs.length - 1]?.path ?? null) : g.activePath;
          return { ...g, tabs, activePath };
        }),
      }));
    },

    pinTab: (groupId, path) => {
      const workspaceId = get().activeWorkspaceId;
      if (!workspaceId) return;
      mutate(workspaceId, (w) => ({
        ...w,
        groups: w.groups.map((g) =>
          g.id !== groupId
            ? g
            : { ...g, tabs: g.tabs.map((t) => (t.path === path ? { ...t, pinned: !t.pinned, preview: false } : t)) },
        ),
      }));
    },

    setActiveTab: (groupId, path) => {
      const workspaceId = get().activeWorkspaceId;
      if (!workspaceId) return;
      mutate(workspaceId, (w) => ({
        ...w,
        activeGroupId: groupId,
        groups: w.groups.map((g) => (g.id === groupId ? { ...g, activePath: path } : g)),
      }));
    },

    setContent: (path, content) => {
      const workspaceId = get().activeWorkspaceId;
      if (!workspaceId) return;
      mutate(workspaceId, (w) => {
        const prev = w.buffers[path];
        if (!prev) return w;
        const dirty = content !== prev.savedContent;
        return {
          ...w,
          buffers: { ...w.buffers, [path]: { ...prev, content, dirty } },
        };
      });
      scheduleSave(workspaceId, path);
    },

    save: async (path) => {
      const workspaceId = get().activeWorkspaceId;
      if (!workspaceId) return;
      const provider = getProvider(workspaceId);
      const buf = get().byWorkspace[workspaceId]?.buffers[path];
      if (!provider || !buf) return;
      mutate(workspaceId, (w) => ({
        ...w,
        buffers: { ...w.buffers, [path]: { ...w.buffers[path], saving: true } },
      }));
      try {
        if (await provider.exists(path)) await provider.writeFile(path, buf.content);
        else await provider.createFile(path, buf.content);
        mutate(workspaceId, (w) => ({
          ...w,
          buffers: {
            ...w.buffers,
            [path]: { ...w.buffers[path], savedContent: buf.content, dirty: false, saving: false },
          },
        }));
        set({ saveError: null });
      } catch (e) {
        mutate(workspaceId, (w) => ({
          ...w,
          buffers: { ...w.buffers, [path]: { ...w.buffers[path], saving: false } },
        }));
        set({ saveError: e instanceof Error ? e.message : "No se pudo guardar." });
      }
    },

    saveAll: async (workspaceId) => {
      const id = workspaceId ?? get().activeWorkspaceId;
      if (!id) return;
      const prev = get().activeWorkspaceId;
      if (prev !== id) set({ activeWorkspaceId: id });
      try {
        const w = get().byWorkspace[id];
        if (!w) return;
        for (const buf of Object.values(w.buffers)) {
          if (buf.dirty) await get().save(buf.path);
        }
      } finally {
        if (prev !== id) set({ activeWorkspaceId: prev });
      }
    },

    setSelection: (path, sel, cursor) => {
      const workspaceId = get().activeWorkspaceId;
      if (!workspaceId) return;
      mutate(workspaceId, (w) => {
        const prev = w.buffers[path];
        if (!prev) return w;
        return { ...w, buffers: { ...w.buffers, [path]: { ...prev, selection: sel, cursor } } };
      });
    },

    toggleSplit: (layout) => {
      const workspaceId = get().activeWorkspaceId;
      if (!workspaceId) return;
      mutate(workspaceId, (w) => {
        if (layout === "single") {
          return { ...w, split: "single", groups: [w.groups[0]!], activeGroupId: w.groups[0]!.id };
        }
        if (w.groups.length === 1) {
          const gid = newId();
          const src = w.groups[0]!;
          const copyTab = src.activePath ? src.tabs.find((t) => t.path === src.activePath) : src.tabs[0];
          const g2: EditorGroup = {
            id: gid,
            tabs: copyTab ? [{ ...copyTab }] : [],
            activePath: copyTab?.path ?? null,
          };
          return { ...w, split: layout, groups: [...w.groups, g2] };
        }
        return { ...w, split: layout };
      });
    },

    setClipboard: (clipboard) => {
      const workspaceId = get().activeWorkspaceId;
      if (!workspaceId) return;
      mutate(workspaceId, (w) => ({ ...w, clipboard }));
    },

    toggleExpanded: (path) => {
      const workspaceId = get().activeWorkspaceId;
      if (!workspaceId) return;
      mutate(workspaceId, (w) => {
        const expanded = new Set(w.expanded);
        if (expanded.has(path)) expanded.delete(path);
        else expanded.add(path);
        return { ...w, expanded };
      });
    },

    setSearch: (p) => {
      const workspaceId = get().activeWorkspaceId;
      if (!workspaceId) return;
      mutate(workspaceId, (w) => ({ ...w, ...p }));
    },

    markSaved: (path, content) => {
      const workspaceId = get().activeWorkspaceId;
      if (!workspaceId) return;
      mutate(workspaceId, (w) => {
        const prev = w.buffers[path];
        if (!prev) return w;
        return { ...w, buffers: { ...w.buffers, [path]: { ...prev, content, savedContent: content, dirty: false } } };
      });
    },
  };
});

export function selectActiveBuffer(): EditorBuffer | undefined {
  const s = useEditorStore.getState();
  const w = s.activeWorkspaceId ? s.byWorkspace[s.activeWorkspaceId] : undefined;
  if (!w) return undefined;
  const group = w.groups.find((g) => g.id === w.activeGroupId) ?? w.groups[0];
  if (!group?.activePath) return undefined;
  return w.buffers[group.activePath];
}
