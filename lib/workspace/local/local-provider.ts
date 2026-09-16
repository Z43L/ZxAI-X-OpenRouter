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
import { assertSafePath, joinPath, splitPath } from "../path";
import { ensureHandlePermission } from "./permissions";
import {
  pathExists,
  readFileText,
  removeEntry,
  resolveDirectory,
  resolveFile,
  writeFileText,
} from "./file-handles";

const TEXT_MAX_BYTES = 2_000_000;

export class LocalWorkspaceProvider implements WorkspaceProvider {
  readonly type = "local" as const;
  readonly readOnly = false;
  private emitter = new WorkspaceEmitter();
  private ignore: Ignore | null = null;

  constructor(
    readonly id: string,
    readonly name: string,
    readonly root: FileSystemDirectoryHandle,
  ) {}

  onDidChange(listener: Parameters<WorkspaceProvider["onDidChange"]>[0]) {
    return this.emitter.on(listener);
  }

  dispose(): void {
    this.emitter.dispose();
  }

  async ensureWritable(): Promise<void> {
    const state = await ensureHandlePermission(this.root, "readwrite");
    if (state !== "granted") {
      throw new Error("Sin permiso de escritura sobre la carpeta local.");
    }
  }

  async readFile(path: string): Promise<FileContent> {
    const p = assertSafePath(path);
    if (isBinaryPath(p)) {
      return { path: p, text: "", encoding: "utf-8", binary: true, language: languageFromPath(p) };
    }
    const handle = await resolveFile(this.root, p);
    const { text, size } = await readFileText(handle);
    if (size > TEXT_MAX_BYTES) throw new Error("El archivo es demasiado grande para editarlo en el navegador.");
    return { path: p, text, encoding: "utf-8", binary: false, language: languageFromPath(p) };
  }

  async writeFile(path: string, content: string): Promise<void> {
    const p = assertSafePath(path);
    await this.ensureWritable();
    const handle = await resolveFile(this.root, p, true);
    await writeFileText(handle, content);
    this.emitter.emit({ kind: "changed", path: p });
  }

  async createFile(path: string, content = ""): Promise<void> {
    const p = assertSafePath(path);
    await this.ensureWritable();
    if (await this.exists(p)) throw new Error(`Ya existe ${p}`);
    const handle = await resolveFile(this.root, p, true);
    await writeFileText(handle, content);
    this.emitter.emit({ kind: "created", path: p });
  }

  async createDirectory(path: string): Promise<void> {
    const p = assertSafePath(path);
    await this.ensureWritable();
    await resolveDirectory(this.root, p, true);
    this.emitter.emit({ kind: "created", path: p });
  }

  async delete(path: string): Promise<void> {
    const p = assertSafePath(path);
    await this.ensureWritable();
    await removeEntry(this.root, p);
    this.emitter.emit({ kind: "deleted", path: p });
  }

  async rename(from: string, to: string): Promise<void> {
    await this.move(from, to);
  }

  async move(from: string, to: string): Promise<void> {
    const src = assertSafePath(from);
    const dest = assertSafePath(to);
    if (src === dest) return;
    await this.ensureWritable();
    const stat = await this.stat(src);
    if (stat.type === "directory") {
      await this.moveDirectory(src, dest);
    } else {
      const content = (await this.readFile(src)).text;
      await this.writeFile(dest, content);
      await removeEntry(this.root, src);
    }
    this.emitter.emit({ kind: "renamed", path: src, to: dest });
  }

  private async moveDirectory(from: string, to: string): Promise<void> {
    await resolveDirectory(this.root, to, true);
    const entries = await this.listDirectory(from);
    for (const e of entries) {
      const nextFrom = joinPath(from, e.name);
      const nextTo = joinPath(to, e.name);
      if (e.type === "directory") await this.moveDirectory(nextFrom, nextTo);
      else {
        const content = (await this.readFile(nextFrom)).text;
        await this.writeFile(nextTo, content);
      }
    }
    await removeEntry(this.root, from);
  }

  async listDirectory(path: string): Promise<WorkspaceEntry[]> {
    const p = assertSafePath(path);
    const dir = p ? await resolveDirectory(this.root, p) : this.root;
    const out: WorkspaceEntry[] = [];
    for await (const [name, handle] of dir.entries() as AsyncIterable<[string, FileSystemHandle]>) {
      if (hideInExplorer(name)) continue;
      const child = p ? joinPath(p, name) : name;
      if (handle.kind === "directory") {
        out.push({ path: child, name, type: "directory" });
      } else {
        let size: number | undefined;
        try {
          const file = await (handle as FileSystemFileHandle).getFile();
          size = file.size;
        } catch {
          /* ignore */
        }
        out.push({ path: child, name, type: "file", size });
      }
    }
    return out.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }

  async stat(path: string): Promise<FileStat> {
    const p = assertSafePath(path);
    if (!p) return { path: "", type: "directory", size: 0 };
    const parts = splitPath(p);
    const name = parts.pop()!;
    const parent = await resolveDirectory(this.root, parts.join("/"));
    try {
      await parent.getDirectoryHandle(name);
      return { path: p, type: "directory", size: 0 };
    } catch {
      const fh = await parent.getFileHandle(name);
      const file = await fh.getFile();
      return { path: p, type: "file", size: file.size, modifiedAt: file.lastModified };
    }
  }

  async exists(path: string): Promise<boolean> {
    return pathExists(this.root, assertSafePath(path));
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const ig = await this.loadIgnore();
    const results: SearchResult[] = [];
    const max = query.maxResults ?? 200;
    await this.walkSearch("", ig, query, results, max);
    return results;
  }

  private async loadIgnore(): Promise<Ignore> {
    if (this.ignore) return this.ignore;
    const extras: string[] = [];
    for (const name of [".gitignore", ".chataiignore"]) {
      try {
        const f = await this.readFile(name);
        extras.push(f.text);
      } catch {
        /* no existe */
      }
    }
    const { createIgnoreMatcher } = await import("../ignore");
    this.ignore = createIgnoreMatcher(extras);
    return this.ignore;
  }

  private async walkSearch(
    dir: string,
    ig: Ignore,
    query: SearchQuery,
    results: SearchResult[],
    max: number,
  ): Promise<void> {
    if (results.length >= max) return;
    let entries: WorkspaceEntry[];
    try {
      entries = await this.listUnfiltered(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (results.length >= max) return;
      if (isIgnored(ig, e.path, e.type === "directory")) continue;
      if (e.type === "directory") {
        await this.walkSearch(e.path, ig, query, results, max);
        continue;
      }
      if (isBinaryPath(e.path)) continue;
      const { matchesGlobList } = await import("../ignore");
      if (query.include && !matchesGlobList(e.path, query.include)) continue;
      if (query.exclude && matchesGlobList(e.path, query.exclude)) continue;
      try {
        const file = await this.readFile(e.path);
        if (file.binary) continue;
        const matches = matchText(file.text, query);
        if (matches.length) results.push({ path: e.path, matches });
      } catch {
        /* skip */
      }
    }
  }

  private async listUnfiltered(path: string): Promise<WorkspaceEntry[]> {
    const p = assertSafePath(path);
    const dir = p ? await resolveDirectory(this.root, p) : this.root;
    const out: WorkspaceEntry[] = [];
    for await (const [name, handle] of dir.entries() as AsyncIterable<[string, FileSystemHandle]>) {
      const child = p ? joinPath(p, name) : name;
      out.push({
        path: child,
        name,
        type: handle.kind === "directory" ? "directory" : "file",
      });
    }
    return out;
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
