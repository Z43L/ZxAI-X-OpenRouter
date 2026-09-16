import { IDB_STORES, idbDelete, idbDeleteBatch, idbGet, idbGetByIndex, idbSet, idbSetBatch } from "./idb";
import type { VirtualFileRecord } from "@/types/workspace";
import { normalizePath } from "@/lib/workspace/path";

export function virtualFileKey(workspaceId: string, path: string): string {
  return `${workspaceId}:${normalizePath(path)}`;
}

export async function getWorkspaceFiles(workspaceId: string): Promise<VirtualFileRecord[]> {
  return idbGetByIndex<VirtualFileRecord>(IDB_STORES.virtualFiles, "by_workspace", workspaceId);
}

export async function getWorkspaceFile(workspaceId: string, path: string): Promise<VirtualFileRecord | undefined> {
  return idbGet<VirtualFileRecord>(IDB_STORES.virtualFiles, virtualFileKey(workspaceId, path));
}

export async function saveWorkspaceFile(record: VirtualFileRecord): Promise<void> {
  await idbSet(IDB_STORES.virtualFiles, record);
}

export async function saveWorkspaceFilesBatch(records: VirtualFileRecord[]): Promise<void> {
  await idbSetBatch(IDB_STORES.virtualFiles, records);
}

export async function deleteWorkspaceFile(workspaceId: string, path: string): Promise<void> {
  await idbDelete(IDB_STORES.virtualFiles, virtualFileKey(workspaceId, path));
}

export async function deleteWorkspaceFileTree(workspaceId: string, path: string): Promise<void> {
  const norm = normalizePath(path);
  const prefix = `${workspaceId}:${norm}/`;
  const exactKey = virtualFileKey(workspaceId, norm);
  const all = await getWorkspaceFiles(workspaceId);
  const toDelete: string[] = [];
  for (const item of all) {
    if (item.id === exactKey || item.id.startsWith(prefix)) {
      toDelete.push(item.id);
    }
  }
  await idbDeleteBatch(IDB_STORES.virtualFiles, toDelete);
}

export async function deleteEntireWorkspaceFiles(workspaceId: string): Promise<void> {
  const all = await getWorkspaceFiles(workspaceId);
  const keys = all.map((f) => f.id);
  await idbDeleteBatch(IDB_STORES.virtualFiles, keys);
}
