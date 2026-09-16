export type BufferStatus = "modified" | "added" | "deleted";

export interface BufferEntry {
  path: string;
  content: string | null;
  original: string | null;
  sha?: string;
  status: BufferStatus;
}

export class GitHubBuffer {
  private files = new Map<string, BufferEntry>();

  get(path: string): BufferEntry | undefined {
    return this.files.get(path);
  }

  has(path: string): boolean {
    return this.files.has(path);
  }

  set(entry: BufferEntry): void {
    this.files.set(entry.path, entry);
  }

  delete(path: string): void {
    this.files.delete(path);
  }

  clear(): void {
    this.files.clear();
  }

  list(): BufferEntry[] {
    return [...this.files.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  isDirty(): boolean {
    return this.files.size > 0;
  }

  write(path: string, content: string, original: string | null, sha?: string): void {
    if (original !== null && content === original) {
      this.files.delete(path);
      return;
    }
    const existing = this.files.get(path);
    const orig = existing?.original ?? original;
    const status: BufferStatus = orig === null ? "added" : "modified";
    this.files.set(path, { path, content, original: orig, sha: existing?.sha ?? sha, status });
  }

  markDeleted(path: string, original: string | null, sha?: string): void {
    const existing = this.files.get(path);
    if (existing?.status === "added") {
      this.files.delete(path);
      return;
    }
    this.files.set(path, {
      path,
      content: null,
      original: existing?.original ?? original,
      sha: existing?.sha ?? sha,
      status: "deleted",
    });
  }

  rename(from: string, to: string): void {
    const src = this.files.get(from);
    if (src) {
      this.files.delete(from);
      this.files.set(to, { ...src, path: to, status: src.original === null ? "added" : "modified" });
      if (src.original !== null && src.status !== "added") {
        this.markDeleted(from, src.original, src.sha);
      }
      return;
    }
  }
}
