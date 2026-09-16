"use client";

import { Check, Loader2, Square } from "lucide-react";
import { useCodingAgentStore } from "@/store/coding-agent-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useAppStore } from "@/store/app-store";
import { useModelStore, selectEffectiveModel } from "@/store/model-store";
import { useEditorStore } from "@/store/editor-store";
import { countLineDelta } from "@/lib/diff/patch";
import { cn } from "@/lib/utils/cn";
import type { AgentMode } from "@/types/code";
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";

export function AgentPanel() {
  const workspaceId = useWorkspaceStore((s) => s.activeId);
  const session = useCodingAgentStore((s) => (workspaceId ? s.sessions[workspaceId] : undefined));
  const activities = useCodingAgentStore((s) => s.activities);
  const status = useCodingAgentStore((s) => s.status);
  const draft = useCodingAgentStore((s) => s.draft);
  const setDraft = useCodingAgentStore((s) => s.setDraft);
  const send = useCodingAgentStore((s) => s.send);
  const stop = useCodingAgentStore((s) => s.stop);
  const setMode = useCodingAgentStore((s) => s.setMode);
  const setAppMode = useAppStore((s) => s.setMode);
  const changeSets = useCodingAgentStore((s) => s.changeSets);
  const activeCsId = useCodingAgentStore((s) => s.activeChangeSetId);
  const cs = activeCsId ? changeSets[activeCsId] : undefined;
  const applyAll = useCodingAgentStore((s) => s.applyAll);
  const rejectAll = useCodingAgentStore((s) => s.rejectAll);
  const applyFile = useCodingAgentStore((s) => s.applyFile);
  const rejectFile = useCodingAgentStore((s) => s.rejectFile);
  const setReviewPath = useCodingAgentStore((s) => s.setReviewPath);
  const reviewPath = useCodingAgentStore((s) => s.reviewPath);
  const model = useModelStore(selectEffectiveModel);
  const busy = status === "thinking" || status === "tool";

  const chips = (() => {
    const buf = useEditorStore.getState().current();
    const group = buf?.groups.find((g) => g.id === buf.activeGroupId);
    const out: string[] = [];
    if (group?.activePath) out.push(group.activePath);
    return out;
  })();

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <div>
          <p className="text-sm font-semibold">AI Assistant</p>
          <p className="text-[11px] text-zinc-400">{model.split("/").pop()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setAppMode("chat")} className="text-[11px] text-zinc-400 hover:underline">
            Continue in Chat
          </button>
          <select
            value={session?.mode ?? "agent"}
            onChange={(e) => setMode(e.target.value as AgentMode)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="ask">Ask</option>
            <option value="edit">Edit</option>
            <option value="agent">Agent</option>
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        {(session?.messages ?? []).length === 0 && (
          <p className="text-sm text-zinc-400">Pregunta sobre tu código. El agente usa tools contra el workspace, no contra GitHub o el disco directamente.</p>
        )}
        {(session?.messages ?? []).map((m) => (
          <div key={m.id} className={cn("mb-3 rounded-xl px-3 py-2 text-sm", m.role === "user" ? "bg-zinc-100 dark:bg-zinc-900" : "bg-transparent")}>
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">{m.role === "user" ? "Tú" : "Agente"}</p>
            {m.role === "user" ? (
              <p className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-200">
                {m.content}
              </p>
            ) : (
              <div className="text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-200">
                <MarkdownRenderer
                  content={m.content || (m.status === "streaming" ? "…" : "")}
                  isStreaming={m.status === "streaming"}
                  className="text-[13px] leading-relaxed"
                />
              </div>
            )}
            {m.error && <p className="mt-1 text-xs text-red-500">{m.error}</p>}
          </div>
        ))}

        {busy && activities.length > 0 && (
          <div className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/60">
            {activities.slice(-12).map((a) => (
              <div key={a.id} className="flex items-center gap-2 py-0.5 text-zinc-500 dark:text-zinc-400">
                {a.status === "running" ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-zinc-400" /> : <Check className="h-3 w-3 shrink-0 text-emerald-500" />}
                <span className="truncate">{a.label}</span>
              </div>
            ))}
          </div>
        )}

        {cs && cs.files.length > 0 && (
          <div className="mb-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-sm font-semibold">La IA propone {cs.files.length} cambios</p>
            <ul className="mt-2 space-y-1 text-xs">
              {cs.files.map((f) => {
                const d = countLineDelta(f.original, f.proposed);
                return (
                  <li key={f.path} className="flex items-center gap-2">
                    <span className="w-4 font-mono text-amber-600">{f.kind === "add" ? "A" : f.kind === "delete" ? "D" : "M"}</span>
                    <button type="button" className="flex-1 truncate text-left hover:underline" onClick={() => setReviewPath(f.path)}>
                      {f.path}
                    </button>
                    <span className="text-emerald-600">+{d.insertions}</span>
                    <span className="text-red-500">-{d.deletions}</span>
                    {f.status === "pending" && (
                      <>
                        <button type="button" className="text-emerald-600" onClick={() => void applyFile(f.path)}>
                          Accept
                        </button>
                        <button type="button" className="text-red-500" onClick={() => rejectFile(f.path)}>
                          Reject
                        </button>
                      </>
                    )}
                    {f.status !== "pending" && <span className="text-zinc-400">{f.status}</span>}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setReviewPath(cs.files[0]?.path ?? null)} className="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700">
                Review
              </button>
              <button type="button" onClick={() => void applyAll()} className="rounded-lg bg-zinc-900 px-2 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
                Apply all
              </button>
              <button type="button" onClick={rejectAll} className="rounded-lg px-2 py-1 text-xs text-zinc-500">
                Reject all
              </button>
            </div>
            {reviewPath && <p className="mt-2 text-[11px] text-zinc-400">Diff de {reviewPath} en el editor central.</p>}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 p-2 dark:border-zinc-800">
        {chips.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {chips.map((c) => (
              <span key={c} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {c}
              </span>
            ))}
          </div>
        )}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={3}
          placeholder="Ask about your code..."
          className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">{session?.mode === "ask" ? "Solo analiza" : session?.mode === "edit" ? "Edita archivos abiertos" : "Puede explorar el workspace"}</span>
          {busy ? (
            <button type="button" onClick={stop} className="flex items-center gap-1 rounded-lg bg-zinc-200 px-2 py-1 text-xs dark:bg-zinc-800">
              <Square className="h-3 w-3" /> Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void send()}
              className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Enviar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
