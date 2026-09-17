const DB_NAME = "chatai.code.v1";
const DB_VERSION = 3;

export const IDB_STORES = {
  localWorkspaces: "local-workspaces",
  recents: "recent-workspaces",
  sessions: "code-sessions",
  githubToken: "github-token",
  virtualFiles: "virtual-files",
  projects: "projects",
  projectFiles: "project-files",
  projectChunks: "project-chunks",
  chatProjectLinks: "chat-project-links",
  studioSessions: "studio-sessions",
} as const;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB no disponible en este entorno"));
  }
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORES.localWorkspaces)) {
          db.createObjectStore(IDB_STORES.localWorkspaces, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(IDB_STORES.recents)) {
          db.createObjectStore(IDB_STORES.recents, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(IDB_STORES.sessions)) {
          db.createObjectStore(IDB_STORES.sessions, { keyPath: "workspaceId" });
        }
        if (!db.objectStoreNames.contains(IDB_STORES.githubToken)) {
          db.createObjectStore(IDB_STORES.githubToken, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(IDB_STORES.virtualFiles)) {
          const store = db.createObjectStore(IDB_STORES.virtualFiles, { keyPath: "id" });
          store.createIndex("by_workspace", "workspaceId", { unique: false });
        }
        if (!db.objectStoreNames.contains(IDB_STORES.projects)) {
          db.createObjectStore(IDB_STORES.projects, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(IDB_STORES.projectFiles)) {
          const store = db.createObjectStore(IDB_STORES.projectFiles, { keyPath: "id" });
          store.createIndex("by_project", "projectId", { unique: false });
        }
        if (!db.objectStoreNames.contains(IDB_STORES.projectChunks)) {
          const store = db.createObjectStore(IDB_STORES.projectChunks, { keyPath: "id" });
          store.createIndex("by_project", "projectId", { unique: false });
        }
        if (!db.objectStoreNames.contains(IDB_STORES.chatProjectLinks)) {
          db.createObjectStore(IDB_STORES.chatProjectLinks, { keyPath: "chatId" });
        }
        if (!db.objectStoreNames.contains(IDB_STORES.studioSessions)) {
          db.createObjectStore(IDB_STORES.studioSessions, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB no disponible"));
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error ?? new Error("Error al leer de IndexedDB"));
    });
  } finally {
    db.close();
  }
}

export async function idbSet<T>(store: string, value: T): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Error al guardar en IndexedDB"));
    });
  } finally {
    db.close();
  }
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Error al eliminar de IndexedDB"));
    });
  } finally {
    db.close();
  }
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error("Error al listar de IndexedDB"));
    });
  } finally {
    db.close();
  }
}

export async function idbGetByIndex<T>(store: string, indexName: string, query: IDBValidKey | IDBKeyRange): Promise<T[]> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const s = tx.objectStore(store);
      const index = s.index(indexName);
      const req = index.getAll(query);
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error("Error al consultar índice de IndexedDB"));
    });
  } finally {
    db.close();
  }
}

export async function idbSetBatch<T>(store: string, values: T[]): Promise<void> {
  if (values.length === 0) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const s = tx.objectStore(store);
      for (const val of values) {
        s.put(val);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Error al guardar lote en IndexedDB"));
    });
  } finally {
    db.close();
  }
}

export async function idbDeleteBatch(store: string, keys: IDBValidKey[]): Promise<void> {
  if (keys.length === 0) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const s = tx.objectStore(store);
      for (const k of keys) {
        s.delete(k);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Error al eliminar lote de IndexedDB"));
    });
  } finally {
    db.close();
  }
}
