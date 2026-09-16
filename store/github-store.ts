import { create } from "zustand";
import type { GitHubRepo, GitHubUser } from "@/lib/workspace/github/github-client";
import { GitHubClient } from "@/lib/workspace/github/github-client";
import { clearGitHubToken, loadGitHubToken, saveGitHubToken } from "@/lib/storage/github-auth";

interface GitHubState {
  token: string;
  remember: boolean;
  user: GitHubUser | null;
  repos: GitHubRepo[];
  loadingRepos: boolean;
  connecting: boolean;
  error: string | null;
  pickerOpen: boolean;
  connectOpen: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  connect: (token: string, remember: boolean) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshRepos: () => Promise<void>;
  setPickerOpen: (open: boolean) => void;
  setConnectOpen: (open: boolean) => void;
  client: () => GitHubClient | null;
}

export const useGitHubStore = create<GitHubState>()((set, get) => ({
  token: "",
  remember: false,
  user: null,
  repos: [],
  loadingRepos: false,
  connecting: false,
  error: null,
  pickerOpen: false,
  connectOpen: false,
  hydrated: false,

  hydrate: async () => {
    try {
      const { token, remember } = await loadGitHubToken();
      set({ token, remember, hydrated: true });
      if (token) {
        try {
          const client = new GitHubClient(token);
          const user = await client.getUser();
          set({ user, error: null });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : "No se pudo validar GitHub." });
        }
      }
    } catch {
      set({ hydrated: true });
    }
  },

  connect: async (token, remember) => {
    const trimmed = token.trim();
    if (!trimmed) return;
    set({ connecting: true, error: null });
    try {
      const client = new GitHubClient(trimmed);
      const user = await client.getUser();
      await saveGitHubToken(trimmed, remember);
      set({ token: trimmed, remember, user, connecting: false, connectOpen: false, pickerOpen: true });
      await get().refreshRepos();
    } catch (e) {
      set({
        connecting: false,
        error: e instanceof Error ? e.message : "Token inválido.",
      });
    }
  },

  disconnect: async () => {
    await clearGitHubToken();
    set({ token: "", user: null, repos: [], remember: false });
  },

  refreshRepos: async () => {
    const token = get().token;
    if (!token) return;
    set({ loadingRepos: true, error: null });
    try {
      const client = new GitHubClient(token);
      const repos = await client.listRepos();
      set({ repos, loadingRepos: false });
    } catch (e) {
      set({ loadingRepos: false, error: e instanceof Error ? e.message : "No se pudieron listar repositorios." });
    }
  },

  setPickerOpen: (open) => set({ pickerOpen: open }),
  setConnectOpen: (open) => set({ connectOpen: open }),
  client: () => {
    const token = get().token;
    return token ? new GitHubClient(token) : null;
  },
}));
