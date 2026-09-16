import type { FileContent, FileStat, SearchQuery, SearchResult, WorkspaceEntry, WorkspaceProvider } from "@/types/workspace";
import { WorkspaceEmitter } from "../events";

/** SSH requiere un gateway WebSocket del usuario. No forma parte de Code v1. */
export class SshWorkspaceProvider implements WorkspaceProvider {
  readonly type = "ssh" as const;
  readonly readOnly = true;
  private emitter = new WorkspaceEmitter();

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

  private unavailable(): never {
    throw new Error("SSH workspace no está disponible en esta versión. Configura un gateway WebSocket en Code v2.");
  }

  readFile(_path: string): Promise<FileContent> {
    this.unavailable();
  }
  writeFile(): Promise<void> {
    this.unavailable();
  }
  createFile(): Promise<void> {
    this.unavailable();
  }
  createDirectory(): Promise<void> {
    this.unavailable();
  }
  delete(): Promise<void> {
    this.unavailable();
  }
  rename(): Promise<void> {
    this.unavailable();
  }
  move(): Promise<void> {
    this.unavailable();
  }
  listDirectory(): Promise<WorkspaceEntry[]> {
    this.unavailable();
  }
  stat(): Promise<FileStat> {
    this.unavailable();
  }
  search(_query: SearchQuery): Promise<SearchResult[]> {
    this.unavailable();
  }
  exists(): Promise<boolean> {
    this.unavailable();
  }
}
