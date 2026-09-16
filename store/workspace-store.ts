import { create } from "zustand";
import type { WorkspaceMeta, WorkspacePermission, WorkspaceProvider } from "@/types/workspace";
import { newId } from "@/lib/utils/ids";
import { ensureHandlePermission, hasDirectoryPicker, queryHandlePermission } from "@/lib/workspace/local/permissions";
import { LocalWorkspaceProvider } from "@/lib/workspace/local/local-provider";
import { GitHubWorkspaceProvider } from "@/lib/workspace/github/github-provider";
import { GitHubClient } from "@/lib/workspace/github/github-client";
import { getProvider, registerProvider, unregisterProvider } from "@/lib/workspace/registry";
import {
  loadLocalWorkspaces,
  loadRecents,
  saveLocalWorkspace,
  saveRecent,
} from "@/lib/storage/local-workspaces";
import { useGitHubStore } from "./github-store";

async function bindWorkspaceEditors(id: string) {
  const { useEditorStore } = await import("./editor-store");
  const { useCodingAgentStore } = await import("./coding-agent-store");
  useEditorStore.getState().resetWorkspace(id);
  useCodingAgentStore.getState().ensureSession(id);
}

export { hasDirectoryPicker };

import { VirtualWorkspaceProvider } from "@/lib/workspace/local/virtual-provider";
import { AndroidWorkspaceProvider } from "@/lib/workspace/android/android-provider";
import { NativeDirectory } from "@/lib/workspace/android/native-directory";
import { isNative } from "@/lib/mobile/native";

interface WorkspaceState {
  workspaces: WorkspaceMeta[];
  recents: WorkspaceMeta[];
  activeId: string | null;
  hydrated: boolean;
  localModalOpen: boolean;
  activity: import("@/types/code").ActivityView;
  leftWidth: number;
  rightWidth: number;
  rightOpen: boolean;
  commandOpen: boolean;
  conflict: { expected: string; actual: string } | null;
  hydrate: () => Promise<void>;
  setLocalModalOpen: (open: boolean) => void;
  setActivity: (v: import("@/types/code").ActivityView) => void;
  setLeftWidth: (n: number) => void;
  setRightWidth: (n: number) => void;
  setRightOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  active: () => WorkspaceMeta | undefined;
  provider: () => WorkspaceProvider | undefined;
  openLocalFolder: () => Promise<void>;
  createVirtualWorkspace: (name: string, initialFiles?: { path: string; text: string }[]) => Promise<string>;
  importFolderToWorkspace: (files: FileList | File[], customName?: string) => Promise<string>;
  reconnectLocal: (id: string) => Promise<void>;
  openGitHubRepo: (owner: string, repo: string, branch?: string) => Promise<void>;
  selectWorkspace: (id: string) => void;
  closeWorkspace: (id: string) => Promise<boolean>;
  setConflict: (c: WorkspaceState["conflict"]) => void;
}

function permFromState(s: PermissionState): WorkspacePermission {
  if (s === "granted" || s === "denied" || s === "prompt") return s;
  return "unknown";
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  workspaces: [],
  recents: [],
  activeId: null,
  hydrated: false,
  localModalOpen: false,
  activity: "explorer",
  leftWidth: 260,
  rightWidth: 380,
  rightOpen: true,
  commandOpen: false,
  conflict: null,

  hydrate: async () => {
    try {
      const locals = await loadLocalWorkspaces();
      const restored: WorkspaceMeta[] = [];
      for (const rec of locals) {
        if (rec.isAndroid && rec.treeUri) {
          let granted = false;
          try {
            const permRes = await NativeDirectory.hasPermission({ uri: rec.treeUri });
            granted = !!permRes.granted;
          } catch {
            granted = false;
          }
          const meta: WorkspaceMeta = {
            id: rec.id,
            name: rec.name,
            type: "local",
            lastOpened: rec.lastOpened,
            permission: granted ? "granted" : "prompt",
            needsReconnect: !granted,
          };
          if (granted) {
            registerProvider(new AndroidWorkspaceProvider(rec.id, rec.name, rec.treeUri));
            restored.push(meta);
          }
          await saveRecent(meta);
          continue;
        }

        if (rec.isVirtual || !rec.handle) {
          registerProvider(new VirtualWorkspaceProvider(rec.id, rec.name));
          const meta: WorkspaceMeta = {
            id: rec.id,
            name: rec.name,
            type: "local",
            lastOpened: rec.lastOpened,
            permission: "granted",
            needsReconnect: false,
          };
          restored.push(meta);
          await saveRecent(meta);
          continue;
        }
        const state = await queryHandlePermission(rec.handle, "readwrite");
        const meta: WorkspaceMeta = {
          id: rec.id,
          name: rec.name,
          type: "local",
          lastOpened: rec.lastOpened,
          permission: permFromState(state),
          needsReconnect: state !== "granted",
        };
        if (state === "granted") {
          registerProvider(new LocalWorkspaceProvider(rec.id, rec.name, rec.handle));
          restored.push(meta);
        }
        await saveRecent(meta);
      }
      const allRecents = await loadRecents();
      set({
        recents: allRecents,
        workspaces: restored,
        activeId: restored[0]?.id ?? null,
        hydrated: true,
      });
      if (restored[0]) await bindWorkspaceEditors(restored[0].id);
    } catch {
      set({ hydrated: true });
    }
  },

  setLocalModalOpen: (localModalOpen) => set({ localModalOpen }),
  setActivity: (activity) => set({ activity }),
  setLeftWidth: (leftWidth) => set({ leftWidth: Math.min(480, Math.max(180, leftWidth)) }),
  setRightWidth: (rightWidth) => set({ rightWidth: Math.min(640, Math.max(280, rightWidth)) }),
  setRightOpen: (rightOpen) => set({ rightOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setConflict: (conflict) => set({ conflict }),

  active: () => get().workspaces.find((w) => w.id === get().activeId),
  provider: () => getProvider(get().activeId),

  openLocalFolder: async () => {
    if (isNative) {
      try {
        const res = await NativeDirectory.pickDirectory();
        if (!res || res.cancelled || !res.uri) {
          return;
        }
        const id = `local:android-${newId()}`;
        const name = res.name || "Carpeta Android";
        const provider = new AndroidWorkspaceProvider(id, name, res.uri);
        registerProvider(provider);
        await saveLocalWorkspace({
          id,
          name,
          isAndroid: true,
          treeUri: res.uri,
          lastOpened: Date.now(),
        });
        const meta: WorkspaceMeta = {
          id,
          name,
          type: "local",
          lastOpened: Date.now(),
          permission: "granted",
        };
        await saveRecent(meta);
        set((s) => ({
          workspaces: [...s.workspaces.filter((w) => w.id !== id), meta],
          recents: [meta, ...s.recents.filter((r) => r.id !== id)],
          activeId: id,
          localModalOpen: false,
        }));
        await bindWorkspaceEditors(id);
        return;
      } catch (err) {
        console.error("Error picking Android directory:", err);
        set({ localModalOpen: true });
        return;
      }
    }

    if (hasDirectoryPicker()) {
      let handle: FileSystemDirectoryHandle;
      try {
        handle = await window.showDirectoryPicker({ mode: "readwrite" });
      } catch (e) {
        if (isUserAbort(e)) return;
        // If system picker failed or security error, fallback to local modal
        set({ localModalOpen: true });
        return;
      }
      const perm = await ensureHandlePermission(handle, "readwrite");
      if (perm !== "granted") throw new Error("Se necesita permiso de lectura y escritura sobre la carpeta.");
      const id = newId();
      const name = handle.name || "Proyecto local";
      const provider = new LocalWorkspaceProvider(id, name, handle);
      registerProvider(provider);
      await saveLocalWorkspace({ id, name, handle, lastOpened: Date.now() });
      const meta: WorkspaceMeta = {
        id,
        name,
        type: "local",
        lastOpened: Date.now(),
        permission: "granted",
      };
      await saveRecent(meta);
      set((s) => ({
        workspaces: [...s.workspaces.filter((w) => w.id !== id), meta],
        recents: [meta, ...s.recents.filter((r) => r.id !== id)],
        activeId: id,
      }));
      await bindWorkspaceEditors(id);
      return;
    }
    // Non-Chromium or mobile environment without showDirectoryPicker
    set({ localModalOpen: true });
  },

  createVirtualWorkspace: async (name, initialFiles) => {
    const id = `local:v-${newId()}`;
    const cleanName = (name || "mi-proyecto").trim();
    const provider = new VirtualWorkspaceProvider(id, cleanName);
    registerProvider(provider);

    const filesToSave = initialFiles && initialFiles.length > 0
      ? initialFiles
      : [
          {
            path: "README.md",
            text: `# ${cleanName}\n\nProyecto local creado en ZxAI.\n`,
          },
          {
            path: "index.js",
            text: `// ${cleanName}\nconsole.log("Hola desde ZxAI");\n`,
          },
        ];

    for (const f of filesToSave) {
      await provider.writeFile(f.path, f.text);
    }

    await saveLocalWorkspace({ id, name: cleanName, isVirtual: true, lastOpened: Date.now() });
    const meta: WorkspaceMeta = {
      id,
      name: cleanName,
      type: "local",
      lastOpened: Date.now(),
      permission: "granted",
    };
    await saveRecent(meta);
    set((s) => ({
      workspaces: [...s.workspaces.filter((w) => w.id !== id), meta],
      recents: [meta, ...s.recents.filter((r) => r.id !== id)],
      activeId: id,
      localModalOpen: false,
    }));
    await bindWorkspaceEditors(id);
    return id;
  },

  importFolderToWorkspace: async (fileList, customName) => {
    const files = Array.from(fileList);
    if (files.length === 0) throw new Error("No se seleccionaron archivos.");

    let detectedName = customName;
    const firstRel = files[0].webkitRelativePath;
    if (!detectedName && firstRel && firstRel.includes("/")) {
      detectedName = firstRel.split("/")[0];
    }
    const cleanName = (detectedName || files[0].name.replace(/\.[^/.]+$/, "") || "Proyecto importado").trim();
    const id = `local:v-${newId()}`;
    const provider = new VirtualWorkspaceProvider(id, cleanName);
    registerProvider(provider);

    for (const file of files) {
      let relPath = file.webkitRelativePath || file.name;
      const parts = relPath.replace(/\\/g, "/").split("/");
      if (parts.length > 1 && parts[0] === cleanName) {
        relPath = parts.slice(1).join("/");
      }
      try {
        const text = await file.text();
        await provider.writeFile(relPath, text);
      } catch {
        await provider.writeFile(relPath, "");
      }
    }

    await saveLocalWorkspace({ id, name: cleanName, isVirtual: true, lastOpened: Date.now() });
    const meta: WorkspaceMeta = {
      id,
      name: cleanName,
      type: "local",
      lastOpened: Date.now(),
      permission: "granted",
    };
    await saveRecent(meta);
    set((s) => ({
      workspaces: [...s.workspaces.filter((w) => w.id !== id), meta],
      recents: [meta, ...s.recents.filter((r) => r.id !== id)],
      activeId: id,
      localModalOpen: false,
    }));
    await bindWorkspaceEditors(id);
    return id;
  },

  reconnectLocal: async (id) => {
    const recents = await loadLocalWorkspaces();
    const rec = recents.find((r) => r.id === id);
    if (!rec) throw new Error("No se encontró el workspace local.");

    if (rec.isAndroid) {
      let treeUri = rec.treeUri;
      let name = rec.name;
      if (!treeUri) {
        const res = await NativeDirectory.pickDirectory();
        if (!res || res.cancelled || !res.uri) return;
        treeUri = res.uri;
        name = res.name || name;
      } else {
        let isGranted = false;
        try {
          const check = await NativeDirectory.hasPermission({ uri: treeUri });
          isGranted = !!check.granted;
        } catch {
          isGranted = false;
        }
        if (!isGranted) {
          const res = await NativeDirectory.pickDirectory();
          if (!res || res.cancelled || !res.uri) {
            throw new Error("No se concedió acceso a la carpeta de Android.");
          }
          treeUri = res.uri;
          name = res.name || name;
        }
      }
      const provider = new AndroidWorkspaceProvider(rec.id, name, treeUri);
      registerProvider(provider);
      const meta: WorkspaceMeta = {
        id: rec.id,
        name,
        type: "local",
        lastOpened: Date.now(),
        permission: "granted",
        needsReconnect: false,
      };
      await saveLocalWorkspace({ ...rec, treeUri, name, lastOpened: Date.now() });
      await saveRecent(meta);
      set((s) => ({
        workspaces: [...s.workspaces.filter((w) => w.id !== id), meta],
        recents: [meta, ...s.recents.filter((r) => r.id !== id)],
        activeId: id,
      }));
      await bindWorkspaceEditors(id);
      return;
    }

    if (rec.isVirtual || !rec.handle) {
      const provider = new VirtualWorkspaceProvider(rec.id, rec.name);
      registerProvider(provider);
      const meta: WorkspaceMeta = {
        id: rec.id,
        name: rec.name,
        type: "local",
        lastOpened: Date.now(),
        permission: "granted",
        needsReconnect: false,
      };
      await saveLocalWorkspace({ ...rec, lastOpened: Date.now() });
      await saveRecent(meta);
      set((s) => ({
        workspaces: [...s.workspaces.filter((w) => w.id !== id), meta],
        recents: [meta, ...s.recents.filter((r) => r.id !== id)],
        activeId: id,
      }));
      await bindWorkspaceEditors(id);
      return;
    }
    const perm = await ensureHandlePermission(rec.handle, "readwrite");
    if (perm !== "granted") throw new Error("El navegador no concedió acceso. Vuelve a autorizar la carpeta.");
    const provider = new LocalWorkspaceProvider(rec.id, rec.name, rec.handle);
    registerProvider(provider);
    const meta: WorkspaceMeta = {
      id: rec.id,
      name: rec.name,
      type: "local",
      lastOpened: Date.now(),
      permission: "granted",
      needsReconnect: false,
    };
    await saveLocalWorkspace({ ...rec, lastOpened: Date.now() });
    await saveRecent(meta);
    set((s) => ({
      workspaces: [...s.workspaces.filter((w) => w.id !== id), meta],
      recents: [meta, ...s.recents.filter((r) => r.id !== id)],
      activeId: id,
    }));
    await bindWorkspaceEditors(id);
  },

  openGitHubRepo: async (owner, repo, branch) => {
    const token = useGitHubStore.getState().token;
    if (!token) throw new Error("Conecta GitHub primero.");
    const client = new GitHubClient(token);
    const info = await client.getRepo(owner, repo);
    const br = branch || info.default_branch;
    const head = await client.getBranch(owner, repo, br);
    const id = `gh:${owner}/${repo}:${br}`;
    const existing = getProvider(id);
    if (existing) {
      set({ activeId: id });
      return;
    }
    const provider = new GitHubWorkspaceProvider(id, `${owner}/${repo}`, client, owner, repo, br, head.commit.sha);
    registerProvider(provider);
    const meta: WorkspaceMeta = {
      id,
      name: `${owner}/${repo}`,
      type: "github",
      lastOpened: Date.now(),
      permission: "granted",
      github: {
        owner,
        repo,
        branch: br,
        defaultBranch: info.default_branch,
        baseSha: head.commit.sha,
        private: info.private,
        description: info.description ?? undefined,
      },
    };
    await saveRecent(meta);
    set((s) => ({
      workspaces: [...s.workspaces.filter((w) => w.id !== id), meta],
      recents: [meta, ...s.recents.filter((r) => r.id !== id)],
      activeId: id,
      conflict: null,
    }));
    await bindWorkspaceEditors(id);
    useGitHubStore.getState().setPickerOpen(false);
  },

  selectWorkspace: (id) => {
    if (!getProvider(id)) return;
    set({ activeId: id, conflict: null });
    void import("./editor-store").then((m) => m.useEditorStore.getState().activateWorkspace(id));
    void import("./coding-agent-store").then((m) => m.useCodingAgentStore.getState().ensureSession(id));
  },

  closeWorkspace: async (id) => {
    const { useEditorStore } = await import("./editor-store");
    const ed = useEditorStore.getState();
    await ed.saveAll(id);

    const leftover = Object.values(useEditorStore.getState().byWorkspace[id]?.buffers ?? {}).some((b) => b.dirty);
    const provider = getProvider(id);
    const uncommitted = provider instanceof GitHubWorkspaceProvider && provider.buffer.isDirty();
    if (leftover || uncommitted) {
      const ok = window.confirm(
        leftover && uncommitted
          ? "Hay cambios sin guardar y commits pendientes. Si cierras, se perderán. ¿Cerrar de todos modos?"
          : uncommitted
            ? "Hay cambios de GitHub sin commit. Si cierras, se perderán. ¿Cerrar de todos modos?"
            : "Hay archivos sin guardar. Si cierras, se perderán. ¿Cerrar de todos modos?",
      );
      if (!ok) return false;
    }

    const closingActive = get().activeId === id;
    unregisterProvider(id);
    const workspaces = get().workspaces.filter((w) => w.id !== id);
    const nextId = closingActive ? (workspaces[0]?.id ?? null) : get().activeId;
    set({
      workspaces,
      activeId: nextId,
      conflict: closingActive ? null : get().conflict,
    });
    ed.disposeWorkspace(id);
    if (nextId) {
      ed.activateWorkspace(nextId);
      const { useCodingAgentStore } = await import("./coding-agent-store");
      useCodingAgentStore.getState().ensureSession(nextId);
    }
    return true;
  },
}));

function isUserAbort(e: unknown): boolean {
  return (e instanceof DOMException && e.name === "AbortError") || (e instanceof Error && e.name === "AbortError");
}
