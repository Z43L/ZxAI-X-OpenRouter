import type { AgentContextSnapshot, ContextChip } from "@/types/agent";
import type { WorkspaceProvider } from "@/types/workspace";
import type { EditorBridge } from "./tool-executor";

const INSTRUCTION_FILES = ["AGENTS.md", "CLAUDE.md", ".zxai/instructions.md", ".chatai/instructions.md"];

export async function buildAgentContext(opts: {
  workspace: WorkspaceProvider;
  bridge: EditorBridge;
  extraChips?: ContextChip[];
}): Promise<AgentContextSnapshot> {
  const current = opts.bridge.currentFile();
  const selection = opts.bridge.selection();
  const openFiles = opts.bridge.openFiles();
  const chips: ContextChip[] = [];
  if (current) chips.push({ id: "file", kind: "file", label: current.path, path: current.path });
  if (selection) chips.push({ id: "sel", kind: "selection", label: `selección ${selection.range}`, path: selection.path });
  chips.push({ id: "ws", kind: "workspace", label: opts.workspace.name });
  if (opts.extraChips) chips.push(...opts.extraChips);

  let instructions = "";
  for (const p of INSTRUCTION_FILES) {
    try {
      if (await opts.workspace.exists(p)) {
        const f = await opts.workspace.readFile(p);
        instructions += `\n\n# ${p}\n${f.text.slice(0, 8000)}`;
      }
    } catch {
      /* ignore */
    }
  }

  return {
    workspaceName: opts.workspace.name,
    workspaceType: opts.workspace.type,
    currentFile: current ? { path: current.path, language: current.language, content: clip(current.content, 12_000) } : undefined,
    selection: selection ?? undefined,
    openFiles,
    instructions: instructions.trim() || undefined,
    chips,
  };
}

export function contextToSystemPrompt(ctx: AgentContextSnapshot, mode: string): string {
  const parts = [
    "Eres el agente de código de ZxAI. Trabajas sobre un workspace a través de herramientas.",
    "Nunca inventes rutas. Usa list_directory, search_text y read_file para explorar.",
    "No pidas ni uses tokens, claves API, contraseñas ni secretos. Si un archivo parece sensible, no lo vuelques entero.",
    "No ejecutes comandos de terminal.",
    `Modo actual: ${mode}.`,
    mode === "ask" ? "Solo analiza. No propongas herramientas de escritura." : "",
    mode === "edit" ? "Solo modifica los archivos abiertos o seleccionados." : "",
    mode === "agent" ? "Puedes explorar el workspace y proponer cambios multi-archivo. Los cambios se revisan como diff salvo que el usuario permita aplicarlos." : "",
    `Workspace: ${ctx.workspaceName} (${ctx.workspaceType}).`,
    ctx.openFiles.length ? `Archivos abiertos:\n${ctx.openFiles.map((f) => `- ${f}`).join("\n")}` : "",
    ctx.currentFile ? `Archivo activo: ${ctx.currentFile.path}` : "",
    ctx.selection ? `Selección ${ctx.selection.range} en ${ctx.selection.path}:\n\`\`\`\n${ctx.selection.text.slice(0, 4000)}\n\`\`\`` : "",
    ctx.gitStatus ? `Git:\n${ctx.gitStatus}` : "",
    ctx.instructions ? `Instrucciones del proyecto:${ctx.instructions}` : "",
    "Responde en el idioma del usuario. Sé concreto y cita rutas.",
  ];
  return parts.filter(Boolean).join("\n\n");
}

function clip(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}\n…` : s;
}
