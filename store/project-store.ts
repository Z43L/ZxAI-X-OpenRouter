import { create } from "zustand";
import type { Project } from "@/types/projects";
import { DEFAULT_PROJECT_COLOR, DEFAULT_PROJECT_ICON } from "@/types/projects";
import {
  createProject as repoCreate,
  deleteProject as repoDelete,
  getProject,
  listProjects,
  listProjectFiles,
  setChatProjectLink,
  getChatProjectLink,
  updateProject as repoUpdate,
  upsertProjectFile,
  deleteProjectFileByPath,
} from "@/lib/projects/store";
import { reindexProject, OpenRouterEmbeddings } from "@/lib/projects/embeddings";

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  indexLoadingId: string | null;
  indexProgress: { done: number; total: number } | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  create: (input: { name: string; icon?: string; color?: string; instructions?: string }) => Promise<Project>;
  rename: (id: string, name: string) => Promise<void>;
  setInstructions: (id: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setActive: (id: string | null) => void;
  reindex: (projectId: string, opts: { apiKey: string; siteTitle?: string; siteReferer?: string; model?: string }) => Promise<{ chunks: number }>;
  addFile: (projectId: string, path: string, content: string, language?: string) => Promise<void>;
  removeFile: (projectId: string, path: string) => Promise<void>;
  listFiles: (projectId: string) => Promise<Array<{ id: string; path: string; bytes: number }>>;
  linkChat: (chatId: string, projectId: string | null) => Promise<void>;
  projectForChat: (chatId: string) => Promise<string | null>;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  activeProjectId: null,
  indexLoadingId: null,
  indexProgress: null,
  hydrated: false,

  hydrate: async () => {
    const projects = await listProjects();
    set({ projects, hydrated: true });
  },

  refresh: async () => {
    const projects = await listProjects();
    set({ projects });
  },

  create: async (input) => {
    const project = await repoCreate({
      name: input.name,
      icon: input.icon ?? DEFAULT_PROJECT_ICON,
      color: input.color ?? DEFAULT_PROJECT_COLOR,
      instructions: input.instructions ?? "",
    });
    const projects = await listProjects();
    set({ projects });
    return project;
  },

  rename: async (id, name) => {
    await repoUpdate(id, { name });
    set({ projects: await listProjects() });
  },

  setInstructions: async (id, text) => {
    await repoUpdate(id, { instructions: text });
    set({ projects: await listProjects() });
  },

  remove: async (id) => {
    await repoDelete(id);
    const projects = await listProjects();
    const active = get().activeProjectId === id ? null : get().activeProjectId;
    set({ projects, activeProjectId: active });
  },

  setActive: (id) => set({ activeProjectId: id }),

  reindex: async (projectId, opts) => {
    const project = await getProject(projectId);
    if (!project) throw new Error("Proyecto no encontrado");
    const files = await listProjectFiles(projectId);
    set({ indexLoadingId: projectId, indexProgress: { done: 0, total: files.length } });
    const result = await reindexProject({
      projectId,
      files: files.map((f) => ({ id: f.id, path: f.path, content: f.content })),
      embedder: new OpenRouterEmbeddings(opts.siteTitle, opts.siteReferer),
      model: opts.model ?? project.embeddingModel,
      apiKey: opts.apiKey,
      onProgress: (done, total) => set({ indexProgress: { done, total } }),
    });
    set({ indexLoadingId: null, indexProgress: null });
    return result;
  },

  addFile: async (projectId, path, content, language) => {
    await upsertProjectFile(projectId, path, content, language);
    set({ projects: await listProjects() });
  },

  removeFile: async (projectId, path) => {
    await deleteProjectFileByPath(projectId, path);
    set({ projects: await listProjects() });
  },

  listFiles: async (projectId) => {
    const all = await listProjectFiles(projectId);
    return all.map((f) => ({ id: f.id, path: f.path, bytes: f.bytes }));
  },

  linkChat: async (chatId, projectId) => {
    await setChatProjectLink(chatId, projectId);
  },

  projectForChat: async (chatId) => {
    const link = await getChatProjectLink(chatId);
    return link?.projectId ?? null;
  },
}));
