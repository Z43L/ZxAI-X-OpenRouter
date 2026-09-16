import { create } from "zustand";
import { getProvider } from "@/lib/workspace/registry";
import { GitHubWorkspaceProvider } from "@/lib/workspace/github/github-provider";
import { RemoteHeadMovedError } from "@/lib/workspace/github/git-operations";
import { useWorkspaceStore } from "./workspace-store";

interface ScmState {
  message: string;
  committing: boolean;
  error: string | null;
  setMessage: (m: string) => void;
  commit: () => Promise<void>;
  discardPath: (path: string) => Promise<void>;
}

export const useScmStore = create<ScmState>()((set, get) => ({
  message: "",
  committing: false,
  error: null,
  setMessage: (message) => set({ message }),
  commit: async () => {
    const provider = getProvider(useWorkspaceStore.getState().activeId);
    if (!(provider instanceof GitHubWorkspaceProvider)) {
      set({ error: "El commit remoto solo está disponible en workspaces de GitHub." });
      return;
    }
    const message = get().message.trim();
    if (!message) {
      set({ error: "Escribe un mensaje de commit." });
      return;
    }
    if (!window.confirm("¿Crear un commit en la rama remota con todos los cambios locales?")) return;
    set({ committing: true, error: null });
    try {
      await provider.commit({ message });
      set({ committing: false, message: "" });
    } catch (e) {
      if (e instanceof RemoteHeadMovedError) {
        useWorkspaceStore.getState().setConflict({ expected: e.expected, actual: e.actual });
        set({ committing: false, error: e.message });
        return;
      }
      set({ committing: false, error: e instanceof Error ? e.message : "No se pudo hacer commit." });
    }
  },
  discardPath: async (path) => {
    const provider = getProvider(useWorkspaceStore.getState().activeId);
    if (!(provider instanceof GitHubWorkspaceProvider)) return;
    provider.buffer.delete(path);
    // fuerza refresco
    useWorkspaceStore.getState().setConflict(useWorkspaceStore.getState().conflict);
  },
}));
