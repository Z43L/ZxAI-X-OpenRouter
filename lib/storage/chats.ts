import type { Chat, Message } from "@/types/chat";
import type { CapabilityConfig } from "@/types/capabilities";
import { cloneCapabilities, DEFAULT_CAPABILITIES, normalizeCapabilities } from "@/lib/capabilities/defaults";
import { newId } from "@/lib/utils/ids";

export const CHATS_KEY = "chatai.chats.v1";
export const SCHEMA_VERSION = 1;

interface StoredState {
  schemaVersion: number;
  chats: Chat[];
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emptyState(): StoredState {
  return { schemaVersion: SCHEMA_VERSION, chats: [] };
}

function migrateChat(raw: Chat): Chat {
  return {
    ...raw,
    capabilities: normalizeCapabilities(raw.capabilities),
    messages: Array.isArray(raw.messages) ? raw.messages : [],
  };
}

function loadState(): StoredState {
  if (!isBrowser()) return emptyState();
  try {
    const raw = window.localStorage.getItem(CHATS_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as StoredState;
    if (!Array.isArray(parsed.chats)) return emptyState();
    return { schemaVersion: SCHEMA_VERSION, chats: parsed.chats.map(migrateChat) };
  } catch {
    return emptyState();
  }
}

function saveState(state: StoredState): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(CHATS_KEY, JSON.stringify(state));
  } catch {
    // Cuota llena o storage bloqueado: se ignora, la app sigue en memoria.
  }
}

export interface ChatRepository {
  list(): Chat[];
  get(id: string): Chat | undefined;
  create(model: string, capabilities?: CapabilityConfig): Chat;
  update(chat: Chat): void;
  remove(id: string): void;
  clear(): void;
}

export function chatTitleFromMessages(messages: Message[]): string {
  const first = messages.find((m) => m.role === "user");
  const text = (first?.content ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "Nueva conversación";
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
}

export class LocalStorageChatRepository implements ChatRepository {
  private state: StoredState;

  constructor() {
    this.state = loadState();
  }

  list(): Chat[] {
    return [...this.state.chats].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id: string): Chat | undefined {
    return this.state.chats.find((c) => c.id === id);
  }

  create(model: string, capabilities?: CapabilityConfig): Chat {
    const now = Date.now();
    const chat: Chat = {
      id: newId(),
      title: "Nueva conversación",
      model,
      createdAt: now,
      updatedAt: now,
      messages: [],
      capabilities: cloneCapabilities(capabilities ?? DEFAULT_CAPABILITIES),
    };
    this.state.chats.push(chat);
    this.persist();
    return chat;
  }

  update(chat: Chat): void {
    const i = this.state.chats.findIndex((c) => c.id === chat.id);
    if (i === -1) {
      this.state.chats.push(chat);
    } else {
      this.state.chats[i] = chat;
    }
    this.persist();
  }

  remove(id: string): void {
    this.state.chats = this.state.chats.filter((c) => c.id !== id);
    this.persist();
  }

  clear(): void {
    this.state = emptyState();
    this.persist();
  }

  /** Persistencia diferida (debounce) para no escribir en cada delta. */
  persistSoon = debounce(() => this.persist(), 800);

  private persist(): void {
    saveState(this.state);
  }
}

function debounce(fn: () => void, ms: number): () => void {
  let t: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (t) clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

// Instancia compartida (la API key vive en otro módulo y nunca se exporta aquí).
export const chatRepository = new LocalStorageChatRepository();
