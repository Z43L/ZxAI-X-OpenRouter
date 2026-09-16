import { IDB_STORES, idbDelete, idbGet, idbGetAll, idbSet } from "@/lib/storage/idb";
import type { LocalWorkspaceRecord, WorkspaceMeta } from "@/types/workspace";

export async function saveLocalWorkspace(record: LocalWorkspaceRecord): Promise<void> {
  await idbSet(IDB_STORES.localWorkspaces, record);
}

export async function loadLocalWorkspaces(): Promise<LocalWorkspaceRecord[]> {
  return idbGetAll<LocalWorkspaceRecord>(IDB_STORES.localWorkspaces);
}

export async function getLocalWorkspace(id: string): Promise<LocalWorkspaceRecord | undefined> {
  return idbGet<LocalWorkspaceRecord>(IDB_STORES.localWorkspaces, id);
}

export async function deleteLocalWorkspace(id: string): Promise<void> {
  await idbDelete(IDB_STORES.localWorkspaces, id);
}

export async function saveRecent(meta: WorkspaceMeta): Promise<void> {
  await idbSet(IDB_STORES.recents, meta);
}

export async function loadRecents(): Promise<WorkspaceMeta[]> {
  const all = await idbGetAll<WorkspaceMeta>(IDB_STORES.recents);
  return all.sort((a, b) => b.lastOpened - a.lastOpened);
}

export async function deleteRecent(id: string): Promise<void> {
  await idbDelete(IDB_STORES.recents, id);
}
