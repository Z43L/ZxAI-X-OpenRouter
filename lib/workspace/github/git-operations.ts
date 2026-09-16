import type { CommitInfo, WorkspaceDiff } from "@/types/workspace";
import { GitHubApiError, GitHubClient, encodeBase64Utf8, type GitHubCommit } from "./github-client";
import type { GitHubBuffer } from "./github-buffer";

export class RemoteHeadMovedError extends Error {
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`HEAD remoto ha cambiado de ${expected.slice(0, 7)} a ${actual.slice(0, 7)}.`);
    this.name = "RemoteHeadMovedError";
  }
}

export async function commitBuffer(opts: {
  client: GitHubClient;
  owner: string;
  repo: string;
  branch: string;
  expectedHeadOid: string;
  message: string;
  buffer: GitHubBuffer;
}): Promise<CommitInfo> {
  const current = await opts.client.getBranch(opts.owner, opts.repo, opts.branch);
  if (current.commit.sha !== opts.expectedHeadOid) {
    throw new RemoteHeadMovedError(opts.expectedHeadOid, current.commit.sha);
  }

  const additions: { path: string; contents: string }[] = [];
  const deletions: { path: string }[] = [];
  for (const entry of opts.buffer.list()) {
    if (entry.status === "deleted") {
      deletions.push({ path: entry.path });
    } else if (entry.content !== null) {
      additions.push({ path: entry.path, contents: encodeBase64Utf8(entry.content) });
    }
  }
  if (additions.length === 0 && deletions.length === 0) {
    throw new Error("No hay cambios para commitear.");
  }

  try {
    const result = await opts.client.createCommitOnBranch({
      owner: opts.owner,
      repo: opts.repo,
      branch: opts.branch,
      message: opts.message,
      expectedHeadOid: opts.expectedHeadOid,
      additions,
      deletions,
    });
    return {
      sha: result.oid,
      message: result.message,
      author: "you",
      date: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof GitHubApiError && /expectedHeadOid|stale|outdated|conflict/i.test(err.message)) {
      const head = await opts.client.getBranch(opts.owner, opts.repo, opts.branch);
      throw new RemoteHeadMovedError(opts.expectedHeadOid, head.commit.sha);
    }
    throw err;
  }
}

export function bufferToDiff(buffer: GitHubBuffer): WorkspaceDiff {
  const files = buffer.list().map((e) => ({
    path: e.path,
    status: e.status,
    original: e.original,
    current: e.content,
  }));
  let insertions = 0;
  let deletions = 0;
  for (const f of files) {
    const oldLines = (f.original ?? "").split("\n").length;
    const newLines = (f.current ?? "").split("\n").length;
    if (f.status === "added") insertions += newLines;
    else if (f.status === "deleted") deletions += oldLines;
    else {
      insertions += Math.max(0, newLines - oldLines);
      deletions += Math.max(0, oldLines - newLines);
    }
  }
  return { files, insertions, deletions };
}

export function mapCommits(list: GitHubCommit[]): CommitInfo[] {
  return list.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.author?.login ?? c.commit.author?.name ?? "unknown",
    date: c.commit.author?.date ?? "",
    url: c.html_url,
  }));
}
