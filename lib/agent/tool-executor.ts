import type { AIChangeSet, AIFileChange, AgentActivity, ToolCallRequest, ToolCallResult } from "@/types/agent";
import type { AgentMode, AiPermissionConfig } from "@/types/code";
import type { VersionedWorkspaceProvider, WorkspaceProvider } from "@/types/workspace";
import { applyUnifiedPatch } from "@/lib/diff/patch";
import { isSensitivePath, redactSecrets } from "@/lib/workspace/sensitive";
import { assertSafePath } from "@/lib/workspace/path";
import { AGENT_TOOLS, extractSymbols } from "./tools";
import { newId } from "@/lib/utils/ids";

export interface EditorBridge {
  openFiles(): string[];
  currentFile(): { path: string; content: string; language?: string } | null;
  selection(): { path: string; text: string; range: string } | null;
}

export interface ExecutorHooks {
  onActivity(activity: AgentActivity): void;
  requestSensitiveAccess(path: string): Promise<boolean>;
  requestDelete(path: string): Promise<boolean>;
}

export class WorkspaceToolExecutor {
  constructor(
    private workspace: WorkspaceProvider,
    private permissions: AiPermissionConfig,
    private bridge: EditorBridge,
    private hooks: ExecutorHooks,
    private mode: AgentMode,
    private allowedWritePaths?: Set<string>,
  ) {}

  async execute(call: ToolCallRequest, changeSet: AIChangeSet): Promise<ToolCallResult> {
    const spec = AGENT_TOOLS.find((t) => t.name === call.name);
    if (!spec) {
      return fail(call, `Herramienta desconocida: ${call.name}`);
    }
    if (this.mode === "ask" && spec.tier !== "safe") {
      return fail(call, "El modo Ask no puede modificar archivos.");
    }
    try {
      const result = await this.dispatch(call, spec.tier, changeSet);
      return { id: call.id, name: call.name, ok: true, content: redactSecrets(result) };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al ejecutar la herramienta.";
      return fail(call, message);
    }
  }

  private async dispatch(call: ToolCallRequest, tier: string, changeSet: AIChangeSet): Promise<string> {
    const arg = (key: string) => String(call.arguments[key] ?? "");
    switch (call.name) {
      case "read_file": {
        const path = assertSafePath(arg("path"));
        await this.ensureRead(path);
        this.hooks.onActivity(act("read", `Leyendo ${path}`, path));
        const file = await this.workspace.readFile(path);
        if (file.binary) return `(binario) ${path}`;
        return clip(file.text, 80_000);
      }
      case "list_directory": {
        const path = arg("path") ? assertSafePath(arg("path")) : "";
        this.hooks.onActivity(act("explore", `Listando ${path || "/"}`, path));
        const entries = await this.workspace.listDirectory(path);
        return entries.map((e) => `${e.type === "directory" ? "dir" : "file"}  ${e.path}`).join("\n") || "(vacío)";
      }
      case "search_text": {
        const query = arg("query");
        this.hooks.onActivity(act("search", `Buscando “${query}”`));
        const results = await this.workspace.search({
          text: query,
          regex: Boolean(call.arguments.regex),
          include: arg("include") || undefined,
          maxResults: 40,
        });
        if (!results.length) return "Sin coincidencias.";
        return results
          .map((r) => `${r.path}\n${r.matches.map((m) => `  L${m.line}: ${m.text.trim()}`).join("\n")}`)
          .join("\n\n");
      }
      case "search_files": {
        const pattern = arg("pattern").toLowerCase();
        this.hooks.onActivity(act("search", `Archivos: ${pattern}`));
        const found: string[] = [];
        await walkFiles(this.workspace, "", found, 400);
        const matched = found.filter((p) => globish(p.toLowerCase(), pattern));
        return matched.slice(0, 80).join("\n") || "Sin archivos.";
      }
      case "get_open_files":
        return this.bridge.openFiles().join("\n") || "(ninguno)";
      case "get_current_file": {
        const cur = this.bridge.currentFile();
        if (!cur) return "(no hay archivo activo)";
        return `${cur.path}\n\n${clip(cur.content, 60_000)}`;
      }
      case "get_selection": {
        const sel = this.bridge.selection();
        if (!sel) return "(sin selección)";
        return `${sel.path} ${sel.range}\n${sel.text}`;
      }
      case "get_file_symbols": {
        const path = assertSafePath(arg("path"));
        await this.ensureRead(path);
        const file = await this.workspace.readFile(path);
        const symbols = extractSymbols(path, file.text);
        return symbols.join("\n") || "(sin símbolos detectados)";
      }
      case "get_diff": {
        const versioned = this.workspace as VersionedWorkspaceProvider;
        if (typeof versioned.getDiff === "function") {
          const diff = await versioned.getDiff();
          if (!diff.files.length) return "Sin cambios.";
          return diff.files.map((f) => `${f.status[0]!.toUpperCase()} ${f.path}`).join("\n");
        }
        return "Este workspace no expone diff (los cambios locales se guardan en disco).";
      }
      case "write_file":
      case "create_file":
      case "apply_patch":
      case "rename_file":
        return this.handleWrite(call, changeSet);
      case "delete_file":
        return this.handleDelete(call, changeSet);
      default:
        throw new Error(`No implementada: ${call.name}`);
    }
    void tier;
  }

  private async handleWrite(call: ToolCallRequest, changeSet: AIChangeSet): Promise<string> {
    const path = assertSafePath(String(call.arguments.path ?? call.arguments.to ?? ""));
    this.restrictEditPath(path);
    await this.ensureRead(path, true);
    const review = call.name === "create_file" ? this.permissions.create === "review" : this.permissions.edit === "review";

    let original: string | null = null;
    try {
      original = (await this.workspace.readFile(path)).text;
    } catch {
      original = null;
    }

    let proposed = "";
    let kind: AIFileChange["kind"] = "modify";
    if (call.name === "create_file") {
      if (original !== null) throw new Error("El archivo ya existe.");
      proposed = String(call.arguments.content ?? "");
      kind = "add";
    } else if (call.name === "apply_patch") {
      if (original === null) throw new Error("No existe el archivo a parchear.");
      proposed = applyUnifiedPatch(original, String(call.arguments.patch ?? ""));
      kind = "modify";
    } else if (call.name === "rename_file") {
      const from = assertSafePath(String(call.arguments.from));
      const to = assertSafePath(String(call.arguments.to));
      this.restrictEditPath(from);
      this.restrictEditPath(to);
      const src = await this.workspace.readFile(from);
      if (review) {
        upsertChange(changeSet, { path: to, kind: "add", original: null, proposed: src.text, status: "pending" });
        upsertChange(changeSet, { path: from, kind: "delete", original: src.text, proposed: null, status: "pending" });
        this.hooks.onActivity(act("edit", `Propuesto rename ${from} → ${to}`, to));
        return `Cambio propuesto (rename). Revisa el diff antes de aplicar.`;
      }
      await this.workspace.rename(from, to);
      return `Renombrado ${from} → ${to}`;
    } else {
      proposed = String(call.arguments.content ?? "");
      kind = original === null ? "add" : "modify";
    }

    if (review) {
      upsertChange(changeSet, { path, kind, original, proposed, status: "pending" });
      this.hooks.onActivity(act("edit", `Propuesto ${kind} ${path}`, path));
      return `Cambio propuesto en ${path}. El usuario debe revisar el diff antes de aplicarlo.`;
    }

    this.hooks.onActivity(act("write", `Escribiendo ${path}`, path));
    if (kind === "add") await this.workspace.createFile(path, proposed);
    else await this.workspace.writeFile(path, proposed);
    upsertChange(changeSet, { path, kind, original, proposed, status: "applied" });
    return `Escrito ${path}`;
  }

  private async handleDelete(call: ToolCallRequest, changeSet: AIChangeSet): Promise<string> {
    const path = assertSafePath(String(call.arguments.path ?? ""));
    this.restrictEditPath(path);
    const ok = await this.hooks.requestDelete(path);
    if (!ok) return `El usuario ha rechazado borrar ${path}.`;
    let original: string | null = null;
    try {
      original = (await this.workspace.readFile(path)).text;
    } catch {
      original = null;
    }
    if (this.permissions.edit === "review") {
      upsertChange(changeSet, { path, kind: "delete", original, proposed: null, status: "pending" });
      return `Borrado propuesto de ${path}. Revisa el diff.`;
    }
    this.hooks.onActivity(act("delete", `Borrando ${path}`, path));
    await this.workspace.delete(path);
    return `Eliminado ${path}`;
  }

  private restrictEditPath(path: string) {
    if (this.mode !== "edit" || !this.allowedWritePaths || this.allowedWritePaths.size === 0) return;
    if (!this.allowedWritePaths.has(path)) {
      throw new Error(`El modo Edit solo puede modificar archivos abiertos/seleccionados. Fuera de alcance: ${path}`);
    }
  }

  private async ensureRead(path: string, writing = false) {
    if (!isSensitivePath(path)) return;
    const allow = await this.hooks.requestSensitiveAccess(path);
    if (!allow) throw new Error(`Acceso denegado a archivo sensible: ${path}`);
    void writing;
  }
}

function fail(call: ToolCallRequest, content: string): ToolCallResult {
  return { id: call.id, name: call.name, ok: false, content };
}

function act(kind: AgentActivity["kind"], label: string, path?: string): AgentActivity {
  return { id: newId(), kind, label, status: "running", path };
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n… [truncado, ${text.length} caracteres]`;
}

function upsertChange(set: AIChangeSet, change: AIFileChange) {
  const i = set.files.findIndex((f) => f.path === change.path);
  if (i >= 0) set.files[i] = change;
  else set.files.push(change);
}

function globish(path: string, pattern: string): boolean {
  const p = pattern.replace(/\*\*/g, "*");
  if (!p.includes("*")) return path.includes(p);
  const re = new RegExp("^" + p.split("*").map(escapeRe).join(".*") + "$");
  return re.test(path) || re.test(path.split("/").pop() ?? "");
}

function escapeRe(s: string) {
  return s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

async function walkFiles(ws: WorkspaceProvider, dir: string, out: string[], max: number) {
  if (out.length >= max) return;
  let entries;
  try {
    entries = await ws.listDirectory(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    if (out.length >= max) return;
    if (e.type === "directory") await walkFiles(ws, e.path, out, max);
    else out.push(e.path);
  }
}
