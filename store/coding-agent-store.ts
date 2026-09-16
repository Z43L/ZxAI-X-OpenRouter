import { create } from "zustand";
import type { AgentActivity, AIChangeSet, AgentRunStatus, CodeMessage, CodeSession, ContextChip } from "@/types/agent";
import type { AgentMode } from "@/types/code";
import { newId } from "@/lib/utils/ids";
import { getProvider } from "@/lib/workspace/registry";
import { runCodingAgent } from "@/lib/agent/coding-agent";
import { applyChangeSet, rejectChangeSet } from "@/lib/agent/changeset";
import { useEditorStore, selectActiveBuffer } from "./editor-store";
import { useSettingsStore } from "./settings-store";
import { useModelStore } from "./model-store";
import { useWorkspaceStore } from "./workspace-store";

interface CodingAgentState {
  sessions: Record<string, CodeSession>;
  activities: AgentActivity[];
  changeSets: Record<string, AIChangeSet>;
  activeChangeSetId: string | null;
  reviewPath: string | null;
  status: AgentRunStatus;
  draft: string;
  chips: ContextChip[];
  ensureSession: (workspaceId: string) => void;
  setMode: (mode: AgentMode) => void;
  setDraft: (v: string) => void;
  send: (text?: string) => Promise<void>;
  stop: () => void;
  applyAll: () => Promise<void>;
  rejectAll: () => void;
  applyFile: (path: string) => Promise<void>;
  rejectFile: (path: string) => void;
  setReviewPath: (path: string | null) => void;
}

let aborter: AbortController | null = null;

export const useCodingAgentStore = create<CodingAgentState>()((set, get) => ({
  sessions: {},
  activities: [],
  changeSets: {},
  activeChangeSetId: null,
  reviewPath: null,
  status: "idle",
  draft: "",
  chips: [],

  ensureSession: (workspaceId) => {
    set((s) => {
      if (s.sessions[workspaceId]) return s;
      const model = useModelStore.getState().effectiveModel();
      return {
        sessions: {
          ...s.sessions,
          [workspaceId]: { workspaceId, messages: [], model, mode: "agent", updatedAt: Date.now() },
        },
      };
    });
  },

  setMode: (mode) => {
    const id = useWorkspaceStore.getState().activeId;
    if (!id) return;
    set((s) => {
      const cur = s.sessions[id];
      if (!cur) return s;
      return { sessions: { ...s.sessions, [id]: { ...cur, mode } } };
    });
  },

  setDraft: (draft) => set({ draft }),

  send: async (text) => {
    const workspaceId = useWorkspaceStore.getState().activeId;
    if (!workspaceId) return;
    const provider = getProvider(workspaceId);
    if (!provider) return;
    const settings = useSettingsStore.getState();
    if (!settings.apiKey.trim()) {
      settings.setSettingsOpen(true);
      return;
    }
    get().ensureSession(workspaceId);
    const session = get().sessions[workspaceId];
    if (!session || get().status === "thinking" || get().status === "tool") return;
    const content = (text ?? get().draft).trim();
    if (!content) return;

    const userMsg: CodeMessage = {
      id: newId(),
      role: "user",
      content,
      status: "complete",
      createdAt: Date.now(),
    };
    const assistant: CodeMessage = {
      id: newId(),
      role: "assistant",
      content: "",
      status: "streaming",
      createdAt: Date.now(),
    };
    set((s) => ({
      draft: text ? s.draft : "",
      status: "thinking",
      activities: [],
      sessions: {
        ...s.sessions,
        [workspaceId]: {
          ...session,
          messages: [...session.messages, userMsg, assistant],
          model: useModelStore.getState().effectiveModel(),
          updatedAt: Date.now(),
        },
      },
    }));

    aborter?.abort();
    aborter = new AbortController();
    const editor = useEditorStore.getState();
    const w = editor.current();
    const activeBuf = selectActiveBuffer();

    try {
      const result = await runCodingAgent({
        workspace: provider,
        bridge: {
          openFiles: () => {
            const cur = useEditorStore.getState().current();
            if (!cur) return [];
            return [...new Set(cur.groups.flatMap((g) => g.tabs.map((t) => t.path)))];
          },
          currentFile: () => {
            const buf = selectActiveBuffer();
            return buf ? { path: buf.path, content: buf.content, language: buf.language } : null;
          },
          selection: () => {
            const buf = selectActiveBuffer();
            if (!buf?.selection) return null;
            const { startLine, startColumn, endLine, endColumn } = buf.selection;
            return {
              path: buf.path,
              text: sliceSelection(buf.content, buf.selection),
              range: `${startLine}:${startColumn}-${endLine}:${endColumn}`,
            };
          },
        },
        permissions: settings.code?.aiPermissions ?? {
          read: "always",
          edit: "review",
          create: "review",
          delete: "ask",
          commit: "ask",
          pr: "ask",
        },
        mode: get().sessions[workspaceId]?.mode ?? "agent",
        model: useModelStore.getState().effectiveModel(),
        userText: content,
        history: session.messages,
        apiKey: settings.apiKey,
        siteTitle: settings.siteTitle,
        siteReferer: settings.siteReferer,
        temperature: settings.temperature,
        signal: aborter.signal,
        onText: (delta) => {
          set((s) => {
            const sess = s.sessions[workspaceId];
            if (!sess) return s;
            return {
              sessions: {
                ...s.sessions,
                [workspaceId]: {
                  ...sess,
                  messages: sess.messages.map((m) =>
                    m.id === assistant.id ? { ...m, content: m.content + delta } : m,
                  ),
                },
              },
            };
          });
        },
        onActivity: (a) => set((s) => ({ activities: [...s.activities.filter((x) => x.id !== a.id), a] })),
        onChangeSet: (cs) =>
          set((s) => ({
            changeSets: { ...s.changeSets, [cs.id]: cs },
            activeChangeSetId: cs.id,
          })),
        requestSensitiveAccess: async (path) => window.confirm(`Archivo sensible\n\n¿Permitir acceso de la IA a ${path}?`),
        requestDelete: async (path) => window.confirm(`¿Borrar ${path}? Esta acción es destructiva.`),
      });

      set((s) => {
        const sess = s.sessions[workspaceId];
        if (!sess) return s;
        return {
          status: "idle",
          activities: [],
          sessions: {
            ...s.sessions,
            [workspaceId]: {
              ...sess,
              messages: sess.messages.map((m) =>
                m.id === assistant.id
                  ? {
                      ...m,
                      content: result.text || m.content,
                      status: "complete",
                      changeSetId: result.changeSet.files.length ? result.changeSet.id : m.changeSetId,
                    }
                  : m,
              ),
            },
          },
        };
      });
      if (result.changeSet.files.length) {
        set((s) => ({ changeSets: { ...s.changeSets, [result.changeSet.id]: result.changeSet }, activeChangeSetId: result.changeSet.id }));
      }
    } catch (e) {
      set((s) => {
        const sess = s.sessions[workspaceId];
        if (!sess) return { status: "error", activities: [] };
        return {
          status: "error",
          activities: [],
          sessions: {
            ...s.sessions,
            [workspaceId]: {
              ...sess,
              messages: sess.messages.map((m) =>
                m.id === assistant.id
                  ? { ...m, status: "error", error: e instanceof Error ? e.message : "Error" }
                  : m,
              ),
            },
          },
        };
      });
    } finally {
      if (aborter?.signal.aborted) {
        set((s) => {
          const sess = s.sessions[workspaceId];
          if (!sess) return { status: "stopped", activities: [] };
          return {
            status: "stopped",
            activities: [],
            sessions: {
              ...s.sessions,
              [workspaceId]: {
                ...sess,
                messages: sess.messages.map((m) =>
                  m.id === assistant.id && m.status === "streaming" ? { ...m, status: "stopped" } : m,
                ),
              },
            },
          };
        });
      } else if (get().status !== "error") {
        set({ status: "idle", activities: [] });
      } else {
        set({ activities: [] });
      }
    }
    void w;
    void activeBuf;
  },

  stop: () => {
    aborter?.abort();
    set({ status: "stopped", activities: [] });
  },

  applyAll: async () => {
    const id = get().activeChangeSetId;
    const cs = id ? get().changeSets[id] : undefined;
    const provider = getProvider(useWorkspaceStore.getState().activeId);
    if (!cs || !provider) return;
    const next = await applyChangeSet(provider, cs);
    set((s) => ({ changeSets: { ...s.changeSets, [next.id]: next } }));
    for (const f of next.files) {
      if (f.status === "applied" && f.proposed != null) {
        useEditorStore.getState().markSaved(f.path, f.proposed);
      }
    }
  },

  rejectAll: () => {
    const id = get().activeChangeSetId;
    const cs = id ? get().changeSets[id] : undefined;
    if (!cs) return;
    const next = rejectChangeSet(cs);
    set((s) => ({ changeSets: { ...s.changeSets, [next.id]: next } }));
  },

  applyFile: async (path) => {
    const id = get().activeChangeSetId;
    const cs = id ? get().changeSets[id] : undefined;
    const provider = getProvider(useWorkspaceStore.getState().activeId);
    if (!cs || !provider) return;
    const next = await applyChangeSet(provider, cs, new Set([path]));
    set((s) => ({ changeSets: { ...s.changeSets, [next.id]: next } }));
    const f = next.files.find((x) => x.path === path);
    if (f?.status === "applied" && f.proposed != null) useEditorStore.getState().markSaved(f.path, f.proposed);
  },

  rejectFile: (path) => {
    const id = get().activeChangeSetId;
    const cs = id ? get().changeSets[id] : undefined;
    if (!cs) return;
    const next = rejectChangeSet(cs, new Set([path]));
    set((s) => ({ changeSets: { ...s.changeSets, [next.id]: next } }));
  },

  setReviewPath: (reviewPath) => set({ reviewPath }),
}));

function sliceSelection(
  content: string,
  sel: { startLine: number; startColumn: number; endLine: number; endColumn: number },
) {
  const lines = content.split("\n");
  if (sel.startLine === sel.endLine) {
    return (lines[sel.startLine - 1] ?? "").slice(sel.startColumn - 1, sel.endColumn - 1);
  }
  const first = (lines[sel.startLine - 1] ?? "").slice(sel.startColumn - 1);
  const mid = lines.slice(sel.startLine, sel.endLine - 1);
  const last = (lines[sel.endLine - 1] ?? "").slice(0, sel.endColumn - 1);
  return [first, ...mid, last].join("\n");
}
