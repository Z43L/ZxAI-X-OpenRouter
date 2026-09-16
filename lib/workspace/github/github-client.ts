export const GITHUB_API = "https://api.github.com";
export const GITHUB_GQL = "https://api.github.com/graphql";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export interface GitHubUser {
  login: string;
  name?: string | null;
  avatar_url?: string;
}

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  private: boolean;
  description: string | null;
  default_branch: string;
  language: string | null;
  updated_at: string;
  html_url: string;
}

export interface GitHubBranch {
  name: string;
  commit: { sha: string };
  protected?: boolean;
}

export interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir" | "symlink" | "submodule";
  content?: string;
  encoding?: string;
  html_url?: string;
}

export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
  };
  author?: { login: string } | null;
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
}

export class GitHubClient {
  constructor(private token: string) {}

  headers(extra?: Record<string, string>): HeadersInit {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...extra,
    };
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${GITHUB_API}${path}`, {
      ...init,
      headers: this.headers(init?.headers as Record<string, string>),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new GitHubApiError(githubErrorMessage(res.status, body), res.status, body);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const res = await fetch(GITHUB_GQL, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ query, variables }),
    });
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (!res.ok || json.errors?.length) {
      throw new GitHubApiError(json.errors?.[0]?.message ?? `GraphQL ${res.status}`, res.status);
    }
    return json.data as T;
  }

  getUser() {
    return this.request<GitHubUser>("/user");
  }

  listRepos(params: { page?: number; perPage?: number; affiliation?: string } = {}) {
    const page = params.page ?? 1;
    const per_page = params.perPage ?? 100;
    const affiliation = params.affiliation ?? "owner,collaborator,organization_member";
    return this.request<GitHubRepo[]>(
      `/user/repos?sort=updated&per_page=${per_page}&page=${page}&affiliation=${encodeURIComponent(affiliation)}`,
    );
  }

  getRepo(owner: string, repo: string) {
    return this.request<GitHubRepo>(`/repos/${owner}/${repo}`);
  }

  listBranches(owner: string, repo: string) {
    return this.request<GitHubBranch[]>(`/repos/${owner}/${repo}/branches?per_page=100`);
  }

  getBranch(owner: string, repo: string, branch: string) {
    return this.request<GitHubBranch>(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`);
  }

  getContents(owner: string, repo: string, path: string, ref: string) {
    const q = path ? `/${encodeGitPath(path)}` : "";
    return this.request<GitHubContentItem | GitHubContentItem[]>(
      `/repos/${owner}/${repo}/contents${q}?ref=${encodeURIComponent(ref)}`,
    );
  }

  getBlob(owner: string, repo: string, sha: string) {
    return this.request<{ content: string; encoding: string; size: number }>(
      `/repos/${owner}/${repo}/git/blobs/${sha}`,
    );
  }

  getCommit(owner: string, repo: string, sha: string) {
    return this.request<{ sha: string; commit: { tree: { sha: string } } }>(
      `/repos/${owner}/${repo}/git/commits/${sha}`,
    );
  }

  getTree(owner: string, repo: string, sha: string, recursive = false) {
    return this.request<{ sha: string; truncated: boolean; tree: GitHubTreeItem[] }>(
      `/repos/${owner}/${repo}/git/trees/${sha}${recursive ? "?recursive=1" : ""}`,
    );
  }

  listCommits(owner: string, repo: string, sha: string, path?: string) {
    const extra = path ? `&path=${encodeURIComponent(path)}` : "";
    return this.request<GitHubCommit[]>(
      `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(sha)}&per_page=30${extra}`,
    );
  }

  createRef(owner: string, repo: string, ref: string, sha: string) {
    return this.request(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref, sha }),
    });
  }

  async createCommitOnBranch(input: {
    owner: string;
    repo: string;
    branch: string;
    message: string;
    expectedHeadOid: string;
    additions: { path: string; contents: string }[];
    deletions: { path: string }[];
  }): Promise<{ oid: string; message: string }> {
    const data = await this.graphql<{
      createCommitOnBranch: { commit: { oid: string; messageHeadline: string } };
    }>(
      `mutation($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
          commit { oid messageHeadline }
        }
      }`,
      {
        input: {
          branch: {
            repositoryNameWithOwner: `${input.owner}/${input.repo}`,
            branchName: input.branch,
          },
          message: { headline: input.message.split("\n")[0], body: input.message.split("\n").slice(1).join("\n") || undefined },
          fileChanges: {
            additions: input.additions,
            deletions: input.deletions,
          },
          expectedHeadOid: input.expectedHeadOid,
        },
      },
    );
    return { oid: data.createCommitOnBranch.commit.oid, message: data.createCommitOnBranch.commit.messageHeadline };
  }
}

function encodeGitPath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((p) => encodeURIComponent(p))
    .join("/");
}

function githubErrorMessage(status: number, body: string): string {
  if (status === 401) return "Token de GitHub inválido o caducado.";
  if (status === 403) return "GitHub ha rechazado la petición (permisos o rate limit).";
  if (status === 404) return "No encontrado en GitHub. Comprueba el repositorio y el token.";
  if (status === 409) return "Conflicto: la rama remota ha cambiado.";
  if (status === 422) return "GitHub no pudo procesar el cambio.";
  try {
    const j = JSON.parse(body) as { message?: string };
    if (j.message) return j.message;
  } catch {
    /* ignore */
  }
  return `Error de GitHub (${status}).`;
}

export function decodeBase64Utf8(b64: string): string {
  const clean = b64.replace(/\n/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
