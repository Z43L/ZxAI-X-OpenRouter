import type { Ignore } from "ignore";
import type {
  FileContent,
  FileStat,
  SearchQuery,
  SearchResult,
  WorkspaceEntry,
  WorkspaceProvider,
} from "@/types/workspace";
import { WorkspaceEmitter } from "../events";
import { hideInExplorer, isIgnored } from "../ignore";
import { isBinaryPath, languageFromPath } from "../language";
import { assertSafePath, basename, dirname, joinPath, normalizePath, splitPath } from "../path";
import {
  deleteWorkspaceFile,
  deleteWorkspaceFileTree,
  getWorkspaceFile,
  getWorkspaceFiles,
  saveWorkspaceFile,
  saveWorkspaceFilesBatch,
  virtualFileKey,
} from "@/lib/storage/virtual-files";
import type { VirtualFileRecord } from "@/types/workspace";

const TEXT_MAX_BYTES = 2_000_000;

export class VirtualWorkspaceProvider implements WorkspaceProvider {
  readonly type = "local" as const;
  readonly readOnly = false;
  private emitter = new WorkspaceEmitter();
  private ignore: Ignore | null = null;

  constructor(
    readonly id: string,
    readonly name: string,
  ) {}

  onDidChange(listener: Parameters<WorkspaceProvider["onDidChange"]>[0]) {
    return this.emitter.on(listener);
  }

  dispose(): void {
    this.emitter.dispose();
  }

  async readFile(path: string): Promise<FileContent> {
    const p = assertSafePath(path);
    if (isBinaryPath(p)) {
      return { path: p, text: "", encoding: "utf-8", binary: true, language: languageFromPath(p) };
    }
    const record = await getWorkspaceFile(this.id, p);
    if (!record || record.type !== "file") {
      throw new Error(`Archivo no encontrado: ${p}`);
    }
    const text = record.text ?? "";
    if ((record.size ?? text.length) > TEXT_MAX_BYTES) {
      throw new Error("El archivo es demasiado grande para editarlo en el editor.");
    }
    return {
      path: p,
      text,
      encoding: "utf-8",
      binary: !!record.binary,
      language: languageFromPath(p),
    };
  }

  async writeFile(path: string, content: string): Promise<void> {
    const p = assertSafePath(path);
    await this.ensureParentDirectories(p);
    const record: VirtualFileRecord = {
      id: virtualFileKey(this.id, p),
      workspaceId: this.id,
      path: p,
      type: "file",
      text: content,
      size: content.length,
      modifiedAt: Date.now(),
      binary: false,
    };
    await saveWorkspaceFile(record);
    this.emitter.emit({ kind: "changed", path: p });
  }

  async createFile(path: string, content = ""): Promise<void> {
    const p = assertSafePath(path);
    if (await this.exists(p)) {
      throw new Error(`Ya existe ${p}`);
    }
    await this.writeFile(p, content);
    this.emitter.emit({ kind: "created", path: p });
  }

  async createDirectory(path: string): Promise<void> {
    const p = assertSafePath(path);
    if (!p) return;
    await this.ensureParentDirectories(p);
    const record: VirtualFileRecord = {
      id: virtualFileKey(this.id, p),
      workspaceId: this.id,
      path: p,
      type: "directory",
      size: 0,
      modifiedAt: Date.now(),
    };
    await saveWorkspaceFile(record);
    this.emitter.emit({ kind: "created", path: p });
  }

  async delete(path: string): Promise<void> {
    const p = assertSafePath(path);
    if (!p) return;
    await deleteWorkspaceFileTree(this.id, p);
    this.emitter.emit({ kind: "deleted", path: p });
  }

  async rename(from: string, to: string): Promise<void> {
    await this.move(from, to);
  }

  async move(from: string, to: string): Promise<void> {
    const src = assertSafePath(from);
    const dst = assertSafePath(to);
    if (!src || !dst || src === dst) return;

    const all = await getWorkspaceFiles(this.id);
    const srcPrefix = `${src}/`;
    const toUpdate: VirtualFileRecord[] = [];
    const toDeleteKeys: string[] = [];

    for (const item of all) {
      if (item.path === src) {
        toDeleteKeys.push(item.id);
        toUpdate.push({
          ...item,
          id: virtualFileKey(this.id, dst),
          path: dst,
          modifiedAt: Date.now(),
        });
      } else if (item.path.startsWith(srcPrefix)) {
        const subPath = dst + item.path.slice(src.length);
        toDeleteKeys.push(item.id);
        toUpdate.push({
          ...item,
          id: virtualFileKey(this.id, subPath),
          path: subPath,
          modifiedAt: Date.now(),
        });
      }
    }

    if (toUpdate.length === 0) {
      throw new Error(`No se encontró el elemento a mover: ${src}`);
    }

    await this.ensureParentDirectories(dst);
    for (const oldKey of toDeleteKeys) {
      await deleteWorkspaceFile(this.id, oldKey.replace(`${this.id}:`, ""));
    }
    await saveWorkspaceFilesBatch(toUpdate);
    this.emitter.emit({ kind: "renamed", path: src, to: dst });
  }

  async listDirectory(path: string): Promise<WorkspaceEntry[]> {
    const p = normalizePath(path);
    const all = await getWorkspaceFiles(this.id);
    const ig = await this.loadIgnore();
    const map = new Map<string, WorkspaceEntry>();

    const prefix = p ? `${p}/` : "";

    for (const item of all) {
      if (!item.path) continue;
      if (prefix) {
        if (!item.path.startsWith(prefix)) continue;
        const rest = item.path.slice(prefix.length);
        if (!rest) continue;
        const slashIdx = rest.indexOf("/");
        if (slashIdx === -1) {
          // Direct child
          map.set(item.path, {
            path: item.path,
            name: basename(item.path),
            type: item.type,
            size: item.size,
            modifiedAt: item.modifiedAt,
          });
        } else {
          // Direct child directory
          const dirName = rest.slice(0, slashIdx);
          const dirPath = `${p}/${dirName}`;
          if (!map.has(dirPath)) {
            map.set(dirPath, {
              path: dirPath,
              name: dirName,
              type: "directory",
              size: 0,
            });
          }
        }
      } else {
        // Root directory
        const slashIdx = item.path.indexOf("/");
        if (slashIdx === -1) {
          map.set(item.path, {
            path: item.path,
            name: item.path,
            type: item.type,
            size: item.size,
            modifiedAt: item.modifiedAt,
          });
        } else {
          const dirName = item.path.slice(0, slashIdx);
          if (!map.has(dirName)) {
            map.set(dirName, {
              path: dirName,
              name: dirName,
              type: "directory",
              size: 0,
            });
          }
        }
      }
    }

    const out: WorkspaceEntry[] = [];
    for (const entry of map.values()) {
      if (hideInExplorer(entry.name)) continue;
      if (isIgnored(ig, entry.path, entry.type === "directory")) continue;
      out.push(entry);
    }

    return out.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }

  async stat(path: string): Promise<FileStat> {
    const p = assertSafePath(path);
    if (!p) return { path: "", type: "directory", size: 0 };
    const record = await getWorkspaceFile(this.id, p);
    if (record) {
      return {
        path: p,
        type: record.type,
        size: record.size ?? 0,
        modifiedAt: record.modifiedAt,
      };
    }
    // Check if it's a directory containing files
    const all = await getWorkspaceFiles(this.id);
    const prefix = `${p}/`;
    const hasChildren = all.some((f) => f.path.startsWith(prefix));
    if (hasChildren) {
      return { path: p, type: "directory", size: 0 };
    }
    throw new Error(`Elemento no encontrado: ${p}`);
  }

  async exists(path: string): Promise<boolean> {
    const p = assertSafePath(path);
    if (!p) return true;
    const record = await getWorkspaceFile(this.id, p);
    if (record) return true;
    const all = await getWorkspaceFiles(this.id);
    const prefix = `${p}/`;
    return all.some((f) => f.path.startsWith(prefix));
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const all = await getWorkspaceFiles(this.id);
    const ig = await this.loadIgnore();
    const results: SearchResult[] = [];
    const max = query.maxResults ?? 200;

    for (const item of all) {
      if (results.length >= max) break;
      if (item.type !== "file" || item.binary) continue;
      if (isIgnored(ig, item.path, false)) continue;
      if (isBinaryPath(item.path)) continue;

      const { matchesGlobList } = await import("../ignore");
      if (query.include && !matchesGlobList(item.path, query.include)) continue;
      if (query.exclude && matchesGlobList(item.path, query.exclude)) continue;

      const text = item.text ?? "";
      const matches = matchText(text, query);
      if (matches.length > 0) {
        results.push({ path: item.path, matches });
      }
    }

    return results;
  }

  private async ensureParentDirectories(path: string): Promise<void> {
    const parts = splitPath(dirname(path));
    let cur = "";
    const toAdd: VirtualFileRecord[] = [];
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      const key = virtualFileKey(this.id, cur);
      const exists = await getWorkspaceFile(this.id, cur);
      if (!exists) {
        toAdd.push({
          id: key,
          workspaceId: this.id,
          path: cur,
          type: "directory",
          size: 0,
          modifiedAt: Date.now(),
        });
      }
    }
    if (toAdd.length > 0) {
      await saveWorkspaceFilesBatch(toAdd);
    }
  }

  private async loadIgnore(): Promise<Ignore> {
    if (this.ignore) return this.ignore;
    const extras: string[] = [];
    for (const name of [".gitignore", ".chataiignore"]) {
      try {
        const f = await this.readFile(name);
        extras.push(f.text);
      } catch {
        /* ignore */
      }
    }
    const { createIgnoreMatcher } = await import("../ignore");
    this.ignore = createIgnoreMatcher(extras);
    return this.ignore;
  }
}

function matchText(text: string, query: SearchQuery) {
  const flags = query.caseSensitive ? "g" : "gi";
  let source = query.text;
  if (!query.regex) source = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (query.wholeWord) source = `\\b${source}\\b`;
  let re: RegExp;
  try {
    re = new RegExp(source, flags);
  } catch {
    return [];
  }
  const lines = text.split(/\n/);
  const matches: SearchResult["matches"] = [];
  for (let i = 0; i < lines.length; i++) {
    re.lastIndex = 0;
    const m = re.exec(lines[i]);
    if (m) matches.push({ line: i + 1, column: (m.index ?? 0) + 1, text: lines[i].slice(0, 240) });
    if (matches.length >= 50) break;
  }
  return matches;
}
