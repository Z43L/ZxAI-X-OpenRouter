"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/project-store";
import { useCapabilityStore } from "@/store/capability-store";
import { useSettingsStore } from "@/store/settings-store";
import { parseAttachments } from "@/lib/attachments";
import { defaultProjectIcons, type Project } from "@/types/projects";

const COLOR_OPTIONS = ["zinc", "blue", "emerald", "amber", "rose", "violet"];

function ProjectFileRow({
  path,
  bytes,
  onRemove,
}: {
  projectId: string;
  path: string;
  bytes: number;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900">
      <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">{path}</span>
      <span className="text-zinc-400">{Math.round(bytes / 1024)} KB</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
      >
        ×
      </button>
    </div>
  );
}

export function ProjectModal({
  project,
  onClose,
}: {
  project: Project | null;
  onClose: () => void;
}) {
  const create = useProjectStore((s) => s.create);
  const rename = useProjectStore((s) => s.rename);
  const setInstructions = useProjectStore((s) => s.setInstructions);
  const remove = useProjectStore((s) => s.remove);
  const addFile = useProjectStore((s) => s.addFile);
  const removeFile = useProjectStore((s) => s.removeFile);
  const reindex = useProjectStore((s) => s.reindex);
  const indexLoading = useProjectStore((s) => s.indexLoadingId === (project?.id ?? null));
  const indexProgress = useProjectStore((s) => s.indexProgress);
  const showToast = useCapabilityStore((s) => s.showToast);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const siteTitle = useSettingsStore((s) => s.siteTitle);
  const siteReferer = useSettingsStore((s) => s.siteReferer);

  const [name, setName] = useState(project?.name ?? "");
  const [icon, setIcon] = useState(project?.icon ?? defaultProjectIcons[0]);
  const [color, setColor] = useState(project?.color ?? COLOR_OPTIONS[0]);
  const [instructions, setInstructionsLocal] = useState(project?.instructions ?? "");
  const [currentProject, setCurrentProject] = useState<Project | null>(project);
  const [files, setFiles] = useState<Array<{ id: string; path: string; bytes: number }>>([]);

  useEffect(() => {
    if (!currentProject) return;
    void useProjectStore
      .getState()
      .listFiles(currentProject.id)
      .then(setFiles);
  }, [currentProject]);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast("Falta nombre", "El proyecto necesita un nombre.");
      return;
    }
    if (currentProject) {
      await rename(currentProject.id, name.trim());
      await setInstructions(currentProject.id, instructions);
      const updated = useProjectStore.getState().projects.find((p) => p.id === currentProject.id);
      if (updated) setCurrentProject(updated);
      showToast("Proyecto actualizado", name.trim());
    } else {
      const created = await create({ name: name.trim(), icon, color, instructions });
      setCurrentProject(created);
      showToast("Proyecto creado", name.trim());
    }
  };

  const handleDelete = async () => {
    if (!currentProject) return;
    await remove(currentProject.id);
    showToast("Proyecto eliminado", currentProject.name);
    onClose();
  };

  const handleAddFiles = async (fileList: FileList | null) => {
    if (!fileList || !currentProject) return;
    const result = await parseAttachments(fileList);
    const textAttachments = result.attachments.filter((a) => a.text);
    for (const att of textAttachments) {
      const path = att.name.split("/").slice(1).join("/") || att.name;
      await addFile(currentProject.id, path, att.text ?? "", att.language);
    }
    const updated = await useProjectStore.getState().listFiles(currentProject.id);
    setFiles(updated);
    if (textAttachments.length > 0) {
      showToast(
        "Archivos añadidos",
        `${textAttachments.length} archivo(s) añadidos al proyecto. Pulsa "Reindexar" para generar embeddings.`,
      );
    } else if (result.warnings.length > 0) {
      showToast("Sin archivos de texto", result.warnings[0]);
    }
  };

  const handleRemoveFile = async (path: string) => {
    if (!currentProject) return;
    await removeFile(currentProject.id, path);
    setFiles(await useProjectStore.getState().listFiles(currentProject.id));
  };

  const handleReindex = async () => {
    if (!currentProject || !apiKey) {
      showToast("Sin API key", "Configura tu API key en Ajustes para indexar.");
      return;
    }
    try {
      const result = await reindex(currentProject.id, {
        apiKey,
        siteTitle,
        siteReferer,
      });
      showToast("Indexación completa", `${result.chunks} fragmento(s) indexados.`);
    } catch (e) {
      showToast("Error al indexar", e instanceof Error ? e.message : "Error desconocido.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {currentProject ? "Editar proyecto" : "Nuevo proyecto"}
        </h2>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-zinc-600 dark:text-zinc-300">
            Nombre
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">Icono</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {defaultProjectIcons.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setIcon(opt)}
                    className={`h-8 w-8 rounded-lg text-base ${
                      icon === opt
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-zinc-100 dark:bg-zinc-800"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">Color</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setColor(opt)}
                    className={`h-8 w-8 rounded-lg border ${
                      color === opt ? "border-zinc-900 dark:border-zinc-100" : "border-transparent"
                    }`}
                    style={{ backgroundColor: toneClass(opt) }}
                  />
                ))}
              </div>
            </div>
          </div>
          <label className="block text-xs text-zinc-600 dark:text-zinc-300">
            Instrucciones del sistema (opcional)
            <textarea
              value={instructions}
              onChange={(e) => setInstructionsLocal(e.target.value)}
              rows={4}
              placeholder="Ej: Responde siempre en español, sé conciso..."
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </label>

          {currentProject && (
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <h3 className="flex-1 text-sm font-semibold">Documentos del proyecto</h3>
                <label className="cursor-pointer rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800">
                  Adjuntar
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void handleAddFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleReindex()}
                  disabled={indexLoading}
                  className="rounded-lg bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  {indexLoading
                    ? `Indexando (${indexProgress?.done ?? 0}/${indexProgress?.total ?? 0})`
                    : "Reindexar"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Los archivos de texto se fragmentan e indexan con embeddings de OpenRouter para usar como contexto automático en los chats del proyecto.
              </p>
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {files.length === 0 ? (
                  <p className="py-3 text-center text-[11px] text-zinc-400">Sin documentos aún.</p>
                ) : (
                  files.map((f) => (
                    <ProjectFileRow
                      key={f.id}
                      projectId={currentProject.id}
                      path={f.path}
                      bytes={f.bytes}
                      onRemove={() => void handleRemoveFile(f.path)}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            {currentProject ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
              >
                Eliminar proyecto
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => void handleSave().then(onClose)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function toneClass(name: string): string {
  switch (name) {
    case "zinc":
      return "#a1a1aa";
    case "blue":
      return "#3b82f6";
    case "emerald":
      return "#10b981";
    case "amber":
      return "#f59e0b";
    case "rose":
      return "#f43f5e";
    case "violet":
      return "#8b5cf6";
    default:
      return "#a1a1aa";
  }
}
