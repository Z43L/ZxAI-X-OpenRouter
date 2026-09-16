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
import { assertSafePath } from "../path";
import { NativeDirectory } from "./native-directory";

const TEXT_MAX_BYTES = 5_000_000;

export class AndroidWorkspaceProvider implements WorkspaceProvider {
  readonly type = "local" as const;
  readonly readOnly = false;
  private emitter = new WorkspaceEmitter();
  private ignore: Ignore | null = null;

  constructor(
    readonly id: string,
    readonly name: string,
    readonly treeUri: string,
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
    const res = await NativeDirectory.readFile({ uri: this.treeUri, path: p });
    if (res.size > TEXT_MAX_BYTES) {
      throw new Error("El archivo es demasiado grande para editarlo en el navegador.");
    }
    return {
      path: p,
      text: res.text,
      encoding: "utf-8",
      binary: false,
      language: languageFromPath(p),
    };
  }

  async writeFile(path: string, content: string): Promise<void> {
    const p = assertSafePath(path);
    await NativeDirectory.writeFile({ uri: this.treeUri, path: p, content });
    this.emitter.emit({ kind: "changed", path: p });
  }

  async createFile(path: string, content = ""): Promise<void> {
    const p = assertSafePath(path);
    if (await this.exists(p)) throw new Error(`Ya existe ${p}`);
    await NativeDirectory.createFile({ uri: this.treeUri, path: p, content });
    this.emitter.emit({ kind: "created", path: p });
  }

  async createDirectory(path: string): Promise<void> {
    const p = assertSafePath(path);
    await NativeDirectory.createDirectory({ uri: this.treeUri, path: p });
    this.emitter.emit({ kind: "created", path: p });
  }

  async delete(path: string): Promise<void> {
    const p = assertSafePath(path);
    await NativeDirectory.deleteEntry({ uri: this.treeUri, path: p });
    this.emitter.emit({ kind: "deleted", path: p });
  }

  async rename(from: string, to: string): Promise<void> {
    await this.move(from, to);
  }

  async move(from: string, to: string): Promise<void> {
    const src = assertSafePath(from);
    const dest = assertSafePath(to);
    if (src === dest) return;
    await NativeDirectory.renameEntry({ uri: this.treeUri, from: src, to: dest });
    this.emitter.emit({ kind: "renamed", path: src, to: dest });
  }

  async listDirectory(path: string): Promise<WorkspaceEntry[]> {
    const p = assertSafePath(path);
    const { entries } = await NativeDirectory.listDirectory({ uri: this.treeUri, path: p });
    return entries
      .filter((e) => !hideInExplorer(e.name))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  }

  async stat(path: string): Promise<FileStat> {
    const p = assertSafePath(path);
    if (!p) return { path: "", type: "directory", size: 0 };
    const res = await NativeDirectory.stat({ uri: this.treeUri, path: p });
    return {
      path: p,
      type: res.type,
      size: res.size,
      modifiedAt: res.modifiedAt,
    };
  }

  async exists(path: string): Promise<boolean> {
    const p = assertSafePath(path);
    if (!p) return true;
    try {
      const res = await NativeDirectory.exists({ uri: this.treeUri, path: p });
      return res.exists;
    } catch {
      return false;
    }
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
      const { entries: rawEntries } = await NativeDirectory.listDirectory({ uri: this.treeUri, path: dir });
      entries = rawEntries;
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
