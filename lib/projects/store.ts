import type { Project, ProjectFile } from "@/types/projects";
import { DEFAULT_EMBEDDING_MODEL, DEFAULT_PROJECT_COLOR, DEFAULT_PROJECT_ICON } from "@/types/projects";
import { idbDelete, idbDeleteBatch, idbGet, idbGetAll, idbGetByIndex, idbSet, idbSetBatch } from "@/lib/storage/idb";
import { IDB_STORES } from "@/lib/storage/idb";
import { newId } from "@/lib/utils/ids";

export async function listProjects(): Promise<Project[]> {
  const all = await idbGetAll<Project>(IDB_STORES.projects);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | undefined> {
  return idbGet<Project>(IDB_STORES.projects, id);
}

export async function createProject(input: {
  name: string;
  icon?: string;
  color?: string;
  instructions?: string;
}): Promise<Project> {
  const now = Date.now();
  const project: Project = {
    id: `proj-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim() || "Nuevo proyecto",
    icon: input.icon ?? DEFAULT_PROJECT_ICON,
    color: input.color ?? DEFAULT_PROJECT_COLOR,
    instructions: input.instructions ?? "",
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    createdAt: now,
    updatedAt: now,
  };
  await idbSet(IDB_STORES.projects, project);
  return project;
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<Project | undefined> {
  const current = await getProject(id);
  if (!current) return undefined;
  const next: Project = { ...current, ...patch, id, updatedAt: Date.now() };
  await idbSet(IDB_STORES.projects, next);
  return next;
}

export async function deleteProject(id: string): Promise<void> {
  await idbDelete(IDB_STORES.projects, id);
  const files = await idbGetByIndex<ProjectFile>(IDB_STORES.projectFiles, "by_project", id);
  if (files.length > 0) {
    await idbDeleteBatch(IDB_STORES.projectFiles, files.map((f: ProjectFile) => f.id));
  }
  await idbDeleteBatch(
    IDB_STORES.projectChunks,
    (await idbGetByIndex<{ id: string }>(IDB_STORES.projectChunks, "by_project", id)).map((c) => c.id),
  );
}

export async function listProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const all = await idbGetByIndex<ProjectFile>(IDB_STORES.projectFiles, "by_project", projectId);
  return all.sort((a, b) => a.path.localeCompare(b.path));
}

export async function getProjectFile(projectId: string, path: string): Promise<ProjectFile | undefined> {
  const all = await listProjectFiles(projectId);
  return all.find((f) => f.path === path);
}

export async function upsertProjectFile(
  projectId: string,
  path: string,
  content: string,
  language?: string,
): Promise<ProjectFile> {
  const existing = await getProjectFile(projectId, path);
  const now = Date.now();
  const record: ProjectFile = {
    id: existing?.id ?? `pf-${projectId}-${newId()}`,
    projectId,
    path,
    content,
    bytes: content.length,
    language,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await idbSet(IDB_STORES.projectFiles, record);
  await updateProject(projectId, {});
  return record;
}

export async function deleteProjectFile(id: string): Promise<void> {
  const file = await idbGet<ProjectFile>(IDB_STORES.projectFiles, id);
  if (!file) return;
  await idbDelete(IDB_STORES.projectFiles, id);
  await idbDeleteBatch(
    IDB_STORES.projectChunks,
    (await idbGetByIndex<{ id: string }>(IDB_STORES.projectChunks, "by_project", file.projectId))
      .filter(async (c) => true)
      .map((c) => c.id),
  );
}

export async function deleteProjectFileByPath(projectId: string, path: string): Promise<void> {
  const file = await getProjectFile(projectId, path);
  if (!file) return;
  await idbDelete(IDB_STORES.projectFiles, file.id);
  const chunks = (
    await idbGetByIndex<{ id: string; fileId: string }>(IDB_STORES.projectChunks, "by_project", projectId)
  ).filter((c) => c.fileId === file.id);
  if (chunks.length > 0) {
    await idbDeleteBatch(IDB_STORES.projectChunks, chunks.map((c) => c.id));
  }
}

export async function listProjectChunks(projectId: string): Promise<
  Array<{
    id: string;
    projectId: string;
    fileId: string;
    filePath: string;
    chunkIndex: number;
    text: string;
    embedding: number[];
    createdAt: number;
  }>
> {
  return idbGetByIndex(IDB_STORES.projectChunks, "by_project", projectId);
}

export async function saveProjectChunks(
  chunks: Array<{
    projectId: string;
    fileId: string;
    filePath: string;
    chunkIndex: number;
    text: string;
    embedding: number[];
  }>,
): Promise<void> {
  if (chunks.length === 0) return;
  const now = Date.now();
  const records = chunks.map((c, i) => ({
    id: `pc-${c.projectId}-${c.fileId}-${c.chunkIndex}-${i}`,
    projectId: c.projectId,
    fileId: c.fileId,
    filePath: c.filePath,
    chunkIndex: c.chunkIndex,
    text: c.text,
    embedding: c.embedding,
    createdAt: now,
  }));
  await idbSetBatch(IDB_STORES.projectChunks, records);
}

export async function clearProjectChunks(projectId: string): Promise<void> {
  const all = await idbGetByIndex<{ id: string }>(IDB_STORES.projectChunks, "by_project", projectId);
  if (all.length > 0) await idbDeleteBatch(IDB_STORES.projectChunks, all.map((c) => c.id));
}

export interface ChatLinkRow {
  chatId: string;
  projectId: string;
  createdAt: number;
}

export async function getChatProjectLink(chatId: string): Promise<ChatLinkRow | undefined> {
  return idbGet<ChatLinkRow>(IDB_STORES.chatProjectLinks, chatId);
}

export async function setChatProjectLink(chatId: string, projectId: string | null): Promise<void> {
  if (projectId === null) {
    await idbDelete(IDB_STORES.chatProjectLinks, chatId);
    return;
  }
  await idbSet(IDB_STORES.chatProjectLinks, {
    chatId,
    projectId,
    createdAt: Date.now(),
  });
}
