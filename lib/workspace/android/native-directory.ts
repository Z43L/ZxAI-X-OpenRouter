import { registerPlugin } from "@capacitor/core";

export interface NativeDirectoryEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: number;
}

export interface PickDirectoryResult {
  uri: string;
  name: string;
  cancelled: boolean;
}

export interface NativeDirectoryPlugin {
  pickDirectory(): Promise<PickDirectoryResult>;
  hasPermission(options: { uri: string }): Promise<{ granted: boolean }>;
  listDirectory(options: { uri: string; path: string }): Promise<{ entries: NativeDirectoryEntry[] }>;
  readFile(options: { uri: string; path: string }): Promise<{ text: string; size: number; modifiedAt?: number }>;
  writeFile(options: { uri: string; path: string; content: string }): Promise<void>;
  createFile(options: { uri: string; path: string; content?: string }): Promise<void>;
  createDirectory(options: { uri: string; path: string }): Promise<void>;
  deleteEntry(options: { uri: string; path: string }): Promise<void>;
  renameEntry(options: { uri: string; from: string; to: string }): Promise<void>;
  stat(options: { uri: string; path: string }): Promise<{ type: "file" | "directory"; size: number; modifiedAt?: number }>;
  exists(options: { uri: string; path: string }): Promise<{ exists: boolean }>;
}

export const NativeDirectory = registerPlugin<NativeDirectoryPlugin>("NativeDirectory");
