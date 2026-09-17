import type { StudioSession } from "@/types/studio";
import { idbDelete, idbGet, idbGetAll, idbSet } from "@/lib/storage/idb";
import { IDB_STORES } from "@/lib/storage/idb";

export async function listStudioSessions(): Promise<StudioSession[]> {
  const all = await idbGetAll<StudioSession>(IDB_STORES.studioSessions);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getStudioSession(id: string): Promise<StudioSession | undefined> {
  return idbGet<StudioSession>(IDB_STORES.studioSessions, id);
}

export async function saveStudioSession(session: StudioSession): Promise<void> {
  await idbSet(IDB_STORES.studioSessions, session);
}

export async function deleteStudioSession(id: string): Promise<void> {
  await idbDelete(IDB_STORES.studioSessions, id);
}
