"use client";

import { useRef, useState } from "react";
import { FolderOpen, FolderPlus, Upload, X, Loader2, HardDrive } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { isNative } from "@/lib/mobile/native";

export function LocalFolderModal() {
  const open = useWorkspaceStore((s) => s.localModalOpen);
  const setOpen = useWorkspaceStore((s) => s.setLocalModalOpen);
  const openLocalFolder = useWorkspaceStore((s) => s.openLocalFolder);
  const createVirtual = useWorkspaceStore((s) => s.createVirtualWorkspace);
  const importFolder = useWorkspaceStore((s) => s.importFolderToWorkspace);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleChooseFiles = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setLoadingText(`Importando ${files.length} archivo(s)...`);
    setError(null);

    try {
      await importFolder(files);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar los archivos.");
    } finally {
      setLoading(false);
      setLoadingText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim() || "mi-proyecto";
    setLoading(true);
    setLoadingText("Creando proyecto local...");
    setError(null);

    try {
      await createVirtual(name);
      setNewProjectName("");
      setShowCreateForm(false);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el proyecto.");
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={() => {
        if (!loading) setOpen(false);
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
              <FolderOpen className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Abrir carpeta local
            </h2>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Trabaja con archivos en tu dispositivo móvil o navegador. Los datos se guardan de forma segura y persistente en el almacenamiento local de la app.
        </p>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">{loadingText}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {/* Hidden directory/file input */}
            <input
              ref={fileInputRef}
              type="file"
              // @ts-expect-error - webkitdirectory and directory are supported non-standard attributes
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />

            {/* Option 0: Android native directory */}
            {isNative && (
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  try {
                    await openLocalFolder();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Error al abrir la carpeta de Android.");
                  }
                }}
                className="flex w-full items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.99] dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:hover:border-indigo-800"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-400">
                  <FolderOpen className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-indigo-950 dark:text-indigo-200">
                    Abrir carpeta del dispositivo (Android)
                  </div>
                  <div className="mt-0.5 text-xs text-indigo-700/80 dark:text-indigo-400/80">
                    Selecciona cualquier carpeta o repositorio de tu almacenamiento interno.
                  </div>
                </div>
              </button>
            )}

            {/* Option 1: Import existing files/folder */}
            <button
              type="button"
              onClick={handleChooseFiles}
              className="flex w-full items-start gap-3 rounded-xl border border-zinc-200 p-3.5 text-left transition-all hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99] dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Seleccionar carpeta o archivos
                </div>
                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Importa una carpeta o proyecto desde tu dispositivo hacia la app.
                </div>
              </div>
            </button>

            {/* Option 2: Create new local project */}
            {!showCreateForm ? (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="flex w-full items-start gap-3 rounded-xl border border-zinc-200 p-3.5 text-left transition-all hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99] dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <FolderPlus className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Crear nuevo proyecto local
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Inicia un proyecto vacío directamente en la memoria local de la app.
                  </div>
                </div>
              </button>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Nombre del nuevo proyecto
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreateProject();
                  }}
                  placeholder="mi-proyecto"
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-hidden focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateProject}
                    className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Crear y abrir
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-1.5 text-[11px] text-zinc-400">
          <HardDrive className="h-3 w-3 shrink-0" />
          <span>{isNative ? "Acceso nativo a carpetas y almacenamiento en Android" : "Almacenamiento persistente en IndexedDB"}</span>
        </div>
      </div>
    </div>
  );
}
