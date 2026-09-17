import { create } from "zustand";
import type { StudioClip, StudioMessage, StudioMode, StudioParams, StudioSession } from "@/types/studio";
import { DEFAULT_STUDIO_PARAMS } from "@/types/studio";
import {
  appendClip,
  appendMessage,
  askAgentDecision,
  buildStudioSession,
  generateOneClip,
  patchParams,
} from "@/lib/studio/stream-loop";
import {
  deleteStudioSession,
  getStudioSession,
  listStudioSessions,
  saveStudioSession,
} from "@/lib/studio/session-store";

interface StudioState {
  sessions: StudioSession[];
  activeSessionId: string | null;
  running: boolean;
  aborter: AbortController | null;
  hydrated: boolean;
  queue: StudioClip[];

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  newSession: (name: string, mode?: StudioMode) => Promise<StudioSession>;
  switchSession: (id: string) => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  update: (session: StudioSession) => Promise<void>;
  setActive: (id: string | null) => void;
  renameActive: (name: string) => Promise<void>;
  appendUserMessage: (text: string) => Promise<void>;
  setMode: (mode: StudioMode) => Promise<void>;
  updateParams: (patch: Partial<StudioParams>) => Promise<void>;
  start: () => Promise<void>;
  stop: () => void;
}

export const useStudioStore = create<StudioState>()((set, get) => {
  async function persist(session: StudioSession) {
    await saveStudioSession(session);
  }

  function active(): StudioSession | null {
    const id = get().activeSessionId;
    if (!id) return null;
    return get().sessions.find((s) => s.id === id) ?? null;
  }

  return {
    sessions: [],
    activeSessionId: null,
    running: false,
    aborter: null,
    hydrated: false,
    queue: [],

    hydrate: async () => {
      const sessions = await listStudioSessions();
      set({ sessions, hydrated: true });
    },

    refresh: async () => {
      const sessions = await listStudioSessions();
      set({ sessions });
    },

    newSession: async (name, mode = "manual") => {
      const session = buildStudioSession(name || "Nueva sesión", mode);
      await persist(session);
      const sessions = await listStudioSessions();
      set({ sessions, activeSessionId: session.id });
      return session;
    },

    switchSession: async (id) => {
      const found = get().sessions.find((s) => s.id === id);
      if (found) {
        set({ activeSessionId: id });
      } else {
        const fresh = await getStudioSession(id);
        if (fresh) {
          const sessions = await listStudioSessions();
          set({ sessions, activeSessionId: id });
        }
      }
    },

    removeSession: async (id) => {
      await deleteStudioSession(id);
      const sessions = await listStudioSessions();
      const next = get().activeSessionId === id ? null : get().activeSessionId;
      set({ sessions, activeSessionId: next });
    },

    update: async (session) => {
      await persist(session);
      const sessions = await listStudioSessions();
      set({ sessions });
    },

    setActive: (id) => set({ activeSessionId: id }),

    renameActive: async (name) => {
      const cur = active();
      if (!cur) return;
      const next = { ...cur, name, params: { ...cur.params, prompt: name }, updatedAt: Date.now() };
      await persist(next);
      const sessions = await listStudioSessions();
      set({ sessions });
    },

    appendUserMessage: async (text) => {
      const cur = active();
      if (!cur) return;
      const updated = appendMessage(cur, { role: "user", content: text });
      await persist(updated);
      const sessions = await listStudioSessions();
      set({ sessions });
    },

    setMode: async (mode) => {
      const cur = active();
      if (!cur) return;
      const next = { ...cur, mode, updatedAt: Date.now() };
      await persist(next);
      const sessions = await listStudioSessions();
      set({ sessions });
    },

    updateParams: async (patch) => {
      const cur = active();
      if (!cur) return;
      const next = patchParams(cur, patch);
      await persist(next);
      const sessions = await listStudioSessions();
      set({ sessions });
    },

    start: async () => {
      const cur = active();
      if (!cur || get().running) return;
      const settings = (await import("@/store/settings-store")).useSettingsStore.getState();
      const apiKey = settings.apiKey;
      if (!apiKey) return;
      if (!cur.params.model) {
        const errorMsg = appendMessage(cur, {
          role: "system",
          content: "Selecciona un modelo de audio en el selector antes de generar.",
        });
        await persist(errorMsg);
        const sessions = await listStudioSessions();
        set({ sessions });
        return;
      }
      const aborter = new AbortController();
      set({ running: true, aborter });

      const loop = async () => {
        let stopFlag = false;
        let local = cur;
        let clipCounter = local.clips.length;
        const refreshSession = async () => {
          const fresh = await getStudioSession(cur.id);
          if (fresh) {
            local = fresh;
            const sessions = await listStudioSessions();
            set({ sessions });
          }
        };
        await refreshSession();

        while (!stopFlag && !aborter.signal.aborted) {
          if (!local.params.model) {
            const sysMsg = appendMessage(local, {
              role: "system",
              content: "Modelo vacío: elige uno en el selector antes de continuar.",
            });
            local = sysMsg;
            await persist(local);
            const sessions = await listStudioSessions();
            set({ sessions });
            stopFlag = true;
            break;
          }
          try {
            clipCounter = local.clips.length;
            const clip = await generateOneClip(local.params, local.params.prompt, {
              apiKey,
              siteTitle: settings.siteTitle,
              siteReferer: settings.siteReferer,
              signal: aborter.signal,
            });
            const indexed = { ...clip, index: clipCounter };
            local = appendClip(local, indexed);
            await persist(local);
            const sessions = await listStudioSessions();
            set({ sessions, queue: [...get().queue, indexed] });
          } catch (e) {
            const detail = e instanceof Error ? e.message : String(e);
            const errorMsg = appendMessage(local, {
              role: "system",
              content: `Error generando clip (modelo: ${local.params.model}): ${detail}`,
            });
            local = errorMsg;
            await persist(local);
            const sessions = await listStudioSessions();
            set({ sessions });
            stopFlag = true;
            break;
          }

          // Modo agente: cada agentInterval clips, refina params.
          if (local.mode === "agent" && local.clips.length % local.params.agentInterval === 0) {
            const decision = await askAgentDecision(
              local.messages,
              local.clips,
              local.params,
              apiKey,
              settings.siteTitle,
              settings.siteReferer,
            );
            if (decision) {
              const nextParams: Partial<StudioParams> = {};
              if (typeof decision.bpm === "number") nextParams.bpm = decision.bpm;
              if (typeof decision.key === "string") nextParams.key = decision.key;
              if (typeof decision.mood === "string") nextParams.mood = decision.mood;
              if (Array.isArray(decision.instruments)) nextParams.instruments = decision.instruments;
              local = patchParams(local, nextParams);
              const assistantNote = appendMessage(local, {
                role: "assistant",
                content: `🎛 ${decision.reasoning ?? "Ajuste aplicado."} (bpm ${nextParams.bpm ?? local.params.bpm}, ${nextParams.key ?? local.params.key}, ${nextParams.mood ?? local.params.mood})`,
              });
              local = assistantNote;
              await persist(local);
              const sessions = await listStudioSessions();
              set({ sessions });
            }
          }

          // Pequeña espera para no saturar.
          await new Promise((r) => setTimeout(r, 250));
        }
        set({ running: false, aborter: null });
      };

      void loop();
    },

    stop: () => {
      const a = get().aborter;
      if (a) {
        a.abort();
        set({ running: false, aborter: null });
      }
    },
  };
});

export { DEFAULT_STUDIO_PARAMS };
export type { StudioClip, StudioMessage, StudioMode, StudioParams, StudioSession };
