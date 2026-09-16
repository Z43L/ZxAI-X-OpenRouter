import type {
  CommitInfo,
  CommitInput,
  FileContent,
  FileStat,
  SearchQuery,
  SearchResult,
  VersionedWorkspaceProvider,
  WorkspaceDiff,
  WorkspaceEntry,
} from "@/types/workspace";
import { WorkspaceEmitter } from "../events";
import { matchesGlobList } from "../ignore";
import { isBinaryPath, languageFromPath } from "../language";
import { assertSafePath, basename, dirname, joinPath } from "../path";
import { GitHubBuffer } from "./github-buffer";
import { GitHubClient, decodeBase64Utf8, type GitHubContentItem } from "./github-client";
import { bufferToDiff, commitBuffer, mapCommits } from "./git-operations";

export class GitHubWorkspaceProvider implements VersionedWorkspaceProvider {
  readonly type = "github" as const;
  readonly readOnly = false;
  private emitter = new WorkspaceEmitter();
  readonly buffer = new GitHubBuffer();
  private listingCache = new Map<string, WorkspaceEntry[]>();
  private originalCache = new Map<string, { text: string; sha?: string }>();
  baseSha: string;

  constructor(
    readonly id: string,
    readonly name: string,
    readonly client: GitHubClient,
    readonly owner: string,
    readonly repo: string,
    public branch: string,
    baseSha: string,
  ) {
    this.baseSha = baseSha;
  }

  onDidChange(listener: Parameters<VersionedWorkspaceProvider["onDidChange"]>[0]) {
    return this.emitter.on(listener);
  }

  dispose(): void {
    this.emitter.dispose();
    this.listingCache.clear();
    this.originalCache.clear();
    this.buffer.clear();
  }

  async readFile(path: string): Promise<FileContent> {
    const p = assertSafePath(path);
    const buffered = this.buffer.get(p);
    if (buffered) {
      if (buffered.status === "deleted" || buffered.content === null) {
        throw new Error(`Archivo eliminado en el buffer: ${p}`);
      }
      return { path: p, text: buffered.content, encoding: "utf-8", binary: false, language: languageFromPath(p) };
    }
    if (isBinaryPath(p)) {
      return { path: p, text: "", encoding: "utf-8", binary: true, language: languageFromPath(p) };
    }
    const item = await this.client.getContents(this.owner, this.repo, p, this.branch);
    if (Array.isArray(item)) throw new Error(`${p} es un directorio.`);
    if (item.type !== "file") throw new Error(`No se puede leer ${p}`);
    let text = "";
    if (item.encoding === "base64" && item.content) {
      text = decodeBase64Utf8(item.content);
    } else {
      const blob = await this.client.getBlob(this.owner, this.repo, item.sha);
      text = blob.encoding === "base64" ? decodeBase64Utf8(blob.content) : blob.content;
    }
    this.originalCache.set(p, { text, sha: item.sha });
    return { path: p, text, encoding: "utf-8", binary: false, language: languageFromPath(p) };
  }

  async writeFile(path: string, content: string): Promise<void> {
    const p = assertSafePath(path);
    const original = await this.originalOrNull(p);
    this.buffer.write(p, content, original?.text ?? null, original?.sha);
    this.listingCache.clear();
    this.emitter.emit({ kind: "changed", path: p });
  }

  async createFile(path: string, content = ""): Promise<void> {
    const p = assertSafePath(path);
    if (await this.exists(p)) throw new Error(`Ya existe ${p}`);
    this.buffer.write(p, content, null);
    this.listingCache.clear();
    this.emitter.emit({ kind: "created", path: p });
  }

  async createDirectory(path: string): Promise<void> {
    const p = assertSafePath(path);
    const gitkeep = joinPath(p, ".gitkeep");
    await this.createFile(gitkeep, "");
  }

  async delete(path: string): Promise<void> {
    const p = assertSafePath(path);
    const stat = await this.stat(p);
    if (stat.type === "directory") {
      const kids = await this.listDirectory(p);
      for (const k of kids) await this.delete(k.path);
      return;
    }
    const original = await this.originalOrNull(p);
    this.buffer.markDeleted(p, original?.text ?? "", original?.sha);
    this.listingCache.clear();
    this.emitter.emit({ kind: "deleted", path: p });
  }

  async rename(from: string, to: string): Promise<void> {
    await this.move(from, to);
  }

  async move(from: string, to: string): Promise<void> {
    const src = assertSafePath(from);
    const dest = assertSafePath(to);
    const file = await this.readFile(src);
    await this.writeFile(dest, file.text);
    await this.delete(src);
    this.emitter.emit({ kind: "renamed", path: src, to: dest });
  }

  async listDirectory(path: string): Promise<WorkspaceEntry[]> {
    const p = assertSafePath(path);
    const cached = this.listingCache.get(p);
    const remote = cached ?? (await this.fetchListing(p));
    if (!cached) this.listingCache.set(p, remote);

    const map = new Map<string, WorkspaceEntry>();
    for (const e of remote) map.set(e.path, e);

    for (const entry of this.buffer.list()) {
      const parent = dirname(entry.path);
      if (parent !== p) continue;
      if (entry.status === "deleted") {
        map.delete(entry.path);
        continue;
      }
      map.set(entry.path, {
        path: entry.path,
        name: basename(entry.path),
        type: "file",
        size: entry.content?.length,
      });
    }

    // directorios virtuales de archivos añadidos en profundidad
    for (const entry of this.buffer.list()) {
      if (entry.status === "deleted") continue;
      const parts = entry.path.split("/");
      if (p) {
        if (!entry.path.startsWith(`${p}/`)) continue;
        const rest = entry.path.slice(p.length + 1).split("/");
        if (rest.length > 1) {
          const child = joinPath(p, rest[0]);
          if (!map.has(child)) map.set(child, { path: child, name: rest[0], type: "directory" });
        }
      } else if (parts.length > 1) {
        const child = parts[0];
        if (!map.has(child)) map.set(child, { path: child, name: child, type: "directory" });
      }
    }

    return [...map.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }

  async stat(path: string): Promise<FileStat> {
    const p = assertSafePath(path);
    if (!p) return { path: "", type: "directory", size: 0 };
    const buffered = this.buffer.get(p);
    if (buffered) {
      if (buffered.status === "deleted") throw new Error("No existe");
      return { path: p, type: "file", size: buffered.content?.length ?? 0 };
    }
    try {
      const item = await this.client.getContents(this.owner, this.repo, p, this.branch);
      if (Array.isArray(item)) return { path: p, type: "directory", size: 0 };
      return { path: p, type: item.type === "dir" ? "directory" : "file", size: item.size };
    } catch {
      const parent = dirname(p);
      const kids = await this.listDirectory(parent);
      const found = kids.find((k) => k.path === p);
      if (!found) throw new Error("No existe");
      return { path: p, type: found.type, size: found.size ?? 0 };
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const max = query.maxResults ?? 80;
    for (const entry of this.buffer.list()) {
      if (entry.content == null) continue;
      const matches = matchText(entry.content, query);
      if (matches.length) results.push({ path: entry.path, matches });
    }
    try {
      const q = `${query.text} repo:${this.owner}/${this.repo}`;
      const data = await this.client.request<{ items: { path: string; text_matches?: { fragment: string }[] }[] }>(
        `/search/code?q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/vnd.github.text-match+json" } as unknown as HeadersInit },
      );
      for (const item of data.items ?? []) {
        if (results.length >= max) break;
        if (this.buffer.get(item.path)?.status === "deleted") continue;
        if (query.include && !matchesGlobList(item.path, query.include)) continue;
        if (query.exclude && matchesGlobList(item.path, query.exclude)) continue;
        if (results.some((r) => r.path === item.path)) continue;
        results.push({
          path: item.path,
          matches: (item.text_matches ?? []).map((m, i) => ({
            line: i + 1,
            column: 1,
            text: m.fragment ?? "",
          })),
        });
      }
    } catch {
      /* search API puede no estar disponible con el PAT */
    }
    return results.slice(0, max);
  }

  async getDiff(): Promise<WorkspaceDiff> {
    return bufferToDiff(this.buffer);
  }

  async getHistory(path?: string): Promise<CommitInfo[]> {
    const list = await this.client.listCommits(this.owner, this.repo, this.branch, path);
    return mapCommits(list);
  }

  async commit(input: CommitInput): Promise<CommitInfo> {
    const info = await commitBuffer({
      client: this.client,
      owner: this.owner,
      repo: this.repo,
      branch: this.branch,
      expectedHeadOid: this.baseSha,
      message: input.message,
      buffer: this.buffer,
    });
    this.buffer.clear();
    this.listingCache.clear();
    this.originalCache.clear();
    this.baseSha = info.sha;
    this.emitter.emit({ kind: "reloaded", path: "" });
    return info;
  }

  async switchBranch(branch: string): Promise<void> {
    if (this.buffer.isDirty()) {
      throw new Error("Hay cambios locales sin commit. Haz commit o descártalos antes de cambiar de rama.");
    }
    const info = await this.client.getBranch(this.owner, this.repo, branch);
    this.branch = branch;
    this.baseSha = info.commit.sha;
    this.listingCache.clear();
    this.originalCache.clear();
    this.emitter.emit({ kind: "reloaded", path: "" });
  }

  async createBranch(name: string): Promise<void> {
    await this.client.createRef(this.owner, this.repo, `refs/heads/${name}`, this.baseSha);
    await this.switchBranch(name);
  }

  async reloadRemoteHead(): Promise<{ previous: string; current: string }> {
    const info = await this.client.getBranch(this.owner, this.repo, this.branch);
    const previous = this.baseSha;
    this.baseSha = info.commit.sha;
    this.listingCache.clear();
    this.originalCache.clear();
    this.emitter.emit({ kind: "reloaded", path: "" });
    return { previous, current: this.baseSha };
  }

  private async originalOrNull(path: string): Promise<{ text: string; sha?: string } | null> {
    const cached = this.originalCache.get(path);
    if (cached) return cached;
    try {
      const file = await this.readRemote(path);
      return file;
    } catch {
      return null;
    }
  }

  private async readRemote(path: string): Promise<{ text: string; sha?: string }> {
    const item = await this.client.getContents(this.owner, this.repo, path, this.branch);
    if (Array.isArray(item) || item.type !== "file") throw new Error("dir");
    const text =
      item.encoding === "base64" && item.content
        ? decodeBase64Utf8(item.content)
        : decodeBase64Utf8((await this.client.getBlob(this.owner, this.repo, item.sha)).content);
    const rec = { text, sha: item.sha };
    this.originalCache.set(path, rec);
    return rec;
  }

  private async fetchListing(path: string): Promise<WorkspaceEntry[]> {
    try {
      const data = await this.client.getContents(this.owner, this.repo, path, this.branch);
      const items: GitHubContentItem[] = Array.isArray(data) ? data : [data];
      return items
        .filter((i) => i.name !== "node_modules")
        .map((i) => ({
          path: i.path,
          name: i.name,
          type: i.type === "dir" ? "directory" : "file",
          size: i.size,
        }));
    } catch {
      return [];
    }
  }
}

function matchText(text: string, query: SearchQuery): SearchResult["matches"] {
  let source = query.regex ? query.text : query.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (query.wholeWord) source = `\\b${source}\\b`;
  let re: RegExp;
  try {
    re = new RegExp(source, query.caseSensitive ? "g" : "gi");
  } catch {
    return [];
  }
  const lines = text.split("\n");
  const matches: SearchResult["matches"] = [];
  for (let i = 0; i < lines.length; i++) {
    re.lastIndex = 0;
    const m = re.exec(lines[i]);
    if (m) matches.push({ line: i + 1, column: (m.index ?? 0) + 1, text: lines[i].slice(0, 240) });
    if (matches.length >= 40) break;
  }
  return matches;
}
