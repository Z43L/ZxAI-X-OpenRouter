export type WorkspaceType = "local" | "github" | "ssh";

export type WorkspacePermission = "granted" | "prompt" | "denied" | "unknown";

export interface FileContent {
  path: string;
  text: string;
  encoding: "utf-8";
  binary: boolean;
  language?: string;
}

export interface WorkspaceEntry {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: number;
}

export interface FileStat {
  path: string;
  type: "file" | "directory";
  size: number;
  modifiedAt?: number;
  readonly?: boolean;
}

export interface SearchQuery {
  text: string;
  regex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  include?: string;
  exclude?: string;
  maxResults?: number;
}

export interface SearchMatch {
  line: number;
  column: number;
  text: string;
}

export interface SearchResult {
  path: string;
  matches: SearchMatch[];
}

export interface WorkspaceDiffFile {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed";
  original?: string | null;
  current?: string | null;
  from?: string;
}

export interface WorkspaceDiff {
  files: WorkspaceDiffFile[];
  insertions: number;
  deletions: number;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  url?: string;
}

export interface CommitInput {
  message: string;
  files?: string[];
}

export type WorkspaceChangeKind = "created" | "deleted" | "changed" | "renamed" | "reloaded";

export interface WorkspaceChangeEvent {
  kind: WorkspaceChangeKind;
  path: string;
  to?: string;
}

export type WorkspaceChangeListener = (event: WorkspaceChangeEvent) => void;

export interface WorkspaceProvider {
  readonly id: string;
  readonly type: WorkspaceType;
  readonly name: string;
  readonly readOnly: boolean;

  readFile(path: string): Promise<FileContent>;
  writeFile(path: string, content: string): Promise<void>;
  createFile(path: string, content?: string): Promise<void>;
  createDirectory(path: string): Promise<void>;
  delete(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  listDirectory(path: string): Promise<WorkspaceEntry[]>;
  stat(path: string): Promise<FileStat>;
  search(query: SearchQuery): Promise<SearchResult[]>;
  exists(path: string): Promise<boolean>;
  onDidChange(listener: WorkspaceChangeListener): () => void;
  dispose(): void;
}

export interface VersionedWorkspaceProvider extends WorkspaceProvider {
  getDiff(): Promise<WorkspaceDiff>;
  getHistory(path?: string): Promise<CommitInfo[]>;
  commit(input: CommitInput): Promise<CommitInfo>;
}

export interface GitHubWorkspaceMeta {
  owner: string;
  repo: string;
  branch: string;
  defaultBranch: string;
  baseSha: string;
  private?: boolean;
  description?: string;
}

export interface WorkspaceMeta {
  id: string;
  name: string;
  type: WorkspaceType;
  lastOpened: number;
  permission: WorkspacePermission;
  github?: GitHubWorkspaceMeta;
  ssh?: { host: string; port: number; username: string };
  needsReconnect?: boolean;
  supportNote?: string;
}

export interface LocalWorkspaceRecord {
  id: string;
  name: string;
  handle?: FileSystemDirectoryHandle;
  isVirtual?: boolean;
  isAndroid?: boolean;
  treeUri?: string;
  lastOpened: number;
}

export interface VirtualFileRecord {
  id: string; // `${workspaceId}:${path}`
  workspaceId: string;
  path: string;
  type: "file" | "directory";
  text?: string;
  size?: number;
  modifiedAt?: number;
  binary?: boolean;
}
