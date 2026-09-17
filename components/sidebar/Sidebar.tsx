"use client";

import { useMemo, useState } from "react";
import { Check, MessageSquare, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { selectEffectiveModel, useModelStore } from "@/store/model-store";
import { useProjectStore } from "@/store/project-store";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { ProjectsSection } from "./ProjectsSection";

export function Sidebar() {
  const isMobile = useIsMobile(1024);
  const chats = useChatStore((s) => s.chats);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const newChat = useChatStore((s) => s.newChat);
  const selectChat = useChatStore((s) => s.selectChat);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const renameChat = useChatStore((s) => s.renameChat);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const searchQuery = useChatStore((s) => s.searchQuery);
  const setSearchQuery = useChatStore((s) => s.setSearchQuery);
  const generation = useChatStore((s) => s.generation);
  const effectiveModel = useModelStore(selectEffectiveModel);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const busy = generation === "streaming" || generation === "submitting";

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return chats.filter((c) => {
      if (activeProjectId && c.projectId !== activeProjectId) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
      );
    });
  }, [chats, searchQuery, activeProjectId]);

  const commitRename = (id: string) => {
    renameChat(id, editTitle);
    setEditingId(null);
  };

  return (
    <div className="flex h-full flex-col">
      <ProjectsSection />
      <div className="p-3">
        <button
          type="button"
          onClick={() => {
            newChat(effectiveModel, activeProjectId);
            if (isMobile) setSidebarOpen(false);
          }}
          className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" /> Nuevo chat
        </button>
        <div className="relative mt-2">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar chats..."
            className="w-full rounded-lg border border-transparent bg-zinc-100 py-1.5 pr-7 pl-8 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-600"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-zinc-400">
            {searchQuery ? "Sin resultados." : "Sin conversaciones todavía."}
          </p>
        ) : (
          visible.map((chat) => {
            const active = chat.id === activeChatId;
            const isEditing = editingId === chat.id;
            const isConfirm = confirmDelete === chat.id;
            return (
              <div
                key={chat.id}
                className={cn(
                  "group relative mb-0.5 rounded-lg text-sm transition-colors",
                  active ? "bg-zinc-200/70 dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60",
                )}
              >
                {isEditing ? (
                  <div className="flex items-center gap-1 p-1.5">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(chat.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() => commitRename(chat.id)}
                      className="rounded p-1.5 text-emerald-600 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      aria-label="Guardar"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : isConfirm ? (
                  <div className="flex items-center gap-1 p-2 text-xs">
                    <span className="flex-1 text-zinc-600 dark:text-zinc-300">¿Eliminar?</span>
                    <button
                      type="button"
                      onClick={() => {
                        deleteChat(chat.id, effectiveModel);
                        setConfirmDelete(null);
                      }}
                      className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700"
                    >
                      Sí
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      selectChat(chat.id);
                      if (isMobile) setSidebarOpen(false);
                    }}
                    disabled={busy && !active}
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-zinc-800 dark:text-zinc-200">
                        {chat.title}
                      </span>
                      <span className="block text-[11px] text-zinc-400">
                        {chat.messages.length} mensajes · {timeAgo(chat.updatedAt)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "hidden shrink-0 items-center gap-0.5 group-hover:flex",
                        active && "flex",
                      )}
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        title="Renombrar"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(chat.id);
                          setEditTitle(chat.title);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            setEditingId(chat.id);
                            setEditTitle(chat.title);
                          }
                        }}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-300/60 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        title="Eliminar"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(chat.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            setConfirmDelete(chat.id);
                          }
                        }}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-300/60 hover:text-red-600 dark:hover:bg-zinc-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    </span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
