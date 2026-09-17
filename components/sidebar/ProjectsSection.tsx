"use client";

import { useEffect, useState } from "react";
import { Plus, Settings2, X, Folder, FolderOpen } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { useChatStore, selectActiveChat } from "@/store/chat-store";
import { useCapabilityStore } from "@/store/capability-store";
import { cn } from "@/lib/utils/cn";
import { ProjectModal } from "./ProjectModal";
import type { Project } from "@/types/projects";

function ActiveProjectBadge({ projectId }: { projectId: string | null }) {
  const setActive = useProjectStore((s) => s.setActive);
  const projects = useProjectStore((s) => s.projects);
  if (!projectId) return null;
  const project = projects.find((p) => p.id === projectId);
  if (!project) return null;
  return (
    <button
      type="button"
      onClick={() => setActive(null)}
      className="mt-2 inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      title="Quitar filtro de proyecto"
    >
      <span>{project.icon}</span>
      <span className="max-w-[120px] truncate">{project.name}</span>
      <X className="h-3 w-3 text-zinc-400" />
    </button>
  );
}

function ProjectRow({
  project,
  isActive,
  onSelect,
  onDelete,
}: {
  project: Project;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors",
        isActive ? "bg-zinc-200/70 dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        title={isActive ? "Quitar filtro" : "Filtrar por proyecto"}
      >
        {isActive ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-800 dark:text-zinc-100">
          {project.icon} {project.name}
        </span>
      </button>
      {confirming ? (
        <span className="flex items-center gap-0.5 text-[10px]">
          <button
            type="button"
            onClick={onDelete}
            className="rounded bg-red-600 px-1.5 py-0.5 font-medium text-white"
          >
            Sí
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded px-1.5 py-0.5 text-zinc-500"
          >
            No
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded p-1 text-zinc-400 opacity-0 hover:bg-zinc-300/60 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-zinc-700"
          aria-label={`Eliminar ${project.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function ProjectsSection() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActive = useProjectStore((s) => s.setActive);
  const remove = useProjectStore((s) => s.remove);
  const newChat = useChatStore((s) => s.newChat);
  const activeChat = useChatStore(selectActiveChat);
  const setChatProject = useChatStore((s) => s.setChatProject);
  const showToast = useCapabilityStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);

  useEffect(() => {
    void useProjectStore.getState().hydrate();
  }, []);

  const handleSelect = (p: Project) => {
    if (activeProjectId === p.id) {
      setActive(null);
    } else {
      setActive(p.id);
    }
  };

  const handleNewInProject = (p: Project) => {
    const id = newChat(activeChat ? activeChat.model : "openrouter/auto", p.id);
    if (id) {
      setChatProject(id, p.id);
      setActive(p.id);
    }
  };

  const handleOpenModal = (p: Project | null) => {
    setEditProject(p);
    setShowModal(true);
  };

  return (
    <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1 text-left text-[11px] font-semibold tracking-wide text-zinc-500 uppercase hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <span className={cn("transition-transform", open ? "rotate-90" : "rotate-0")}>▸</span>
          Proyectos ({projects.length})
        </button>
        <button
          type="button"
          onClick={() => handleOpenModal(null)}
          title="Nuevo proyecto"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-0.5">
          {projects.length === 0 && (
            <p className="px-2 py-2 text-[11px] text-zinc-400">
              Sin proyectos. Crea uno para agrupar chats y documentos.
            </p>
          )}
          {projects.map((p) => (
            <div key={p.id} className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <ProjectRow
                  project={p}
                  isActive={activeProjectId === p.id}
                  onSelect={() => handleSelect(p)}
                  onDelete={() => {
                    void remove(p.id).then(() => {
                      showToast("Proyecto eliminado", p.name);
                    });
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => handleNewInProject(p)}
                title="Nuevo chat en proyecto"
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleOpenModal(p)}
                title="Editar"
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <ActiveProjectBadge projectId={activeProjectId} />
      {showModal && (
        <ProjectModal
          project={editProject}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
