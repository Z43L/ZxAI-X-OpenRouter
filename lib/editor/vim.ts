"use client";

/**
 * Wrapper de `monaco-vim` con seguridad ante errores de carga y sin acoplar
 * al ciclo de vida de un editor concreto (devuelve una función dispose).
 *
 * Uso:
 *   const handle = await attachVimMode(editor, monaco);
 *   ...
 *   handle.dispose();
 *
 * El statusBar DOM se inyecta en `document.body` y muestra el modo actual
 * con colores: NORMAL (azul), INSERT (verde), VISUAL (violeta).
 * Otros componentes pueden suscribirse al cambio de modo vía `onVimModeChange`
 * o cambiar el modo programáticamente con `setActiveVimMode()`.
 */

type VimMode = "normal" | "insert" | "visual" | "replace" | "command" | string;

type VimAdapterInstance = {
  dispose: () => void;
  handleKeyDown: (e: unknown) => void;
};

type VimInitFn = (
  editor: import("monaco-editor").editor.IStandaloneCodeEditor,
  statusbarNode?: HTMLElement | null,
) => VimAdapterInstance;

let cachedInit: VimInitFn | null = null;

async function loadVimInit(): Promise<VimInitFn | null> {
  if (cachedInit) return cachedInit;
  try {
    const mod = await import("monaco-vim");
    const init = (mod as { initVimMode?: VimInitFn }).initVimMode;
    if (typeof init !== "function") return null;
    cachedInit = init;
    return init;
  } catch (e) {
    console.warn("[vim] monaco-vim no cargó:", e);
    return null;
  }
}

export type VimModeListener = (mode: VimMode) => void;
export type { VimMode };
const globalListeners = new Set<VimModeListener>();

export function onVimModeChange(listener: VimModeListener): () => void {
  globalListeners.add(listener);
  return () => {
    globalListeners.delete(listener);
  };
}

function emitMode(mode: VimMode): void {
  for (const l of globalListeners) {
    try {
      l(mode);
    } catch {
      /* ignore */
    }
  }
}

let activeHandle: VimModeHandle | null = null;
let activeEditor: import("monaco-editor").editor.IStandaloneCodeEditor | null = null;

export function getActiveVimHandle(): VimModeHandle | null {
  return activeHandle;
}

/**
 * Cambia el modo del handle activo, si lo hay.
 */
export function setActiveVimMode(mode: VimMode): void {
  const h = activeHandle;
  if (!h) return;
  h.setMode(mode);
  h.setCurrentMode(mode);
  emitMode(String(mode).toLowerCase());
  activeEditor?.focus();
}

export interface VimModeHandle {
  dispose: () => void;
  statusBar: HTMLElement | null;
  getMode: () => VimMode;
  setMode: (mode: VimMode) => void;
  setCurrentMode: (mode: VimMode) => void;
}

function styleStatusBar(node: HTMLElement, mode: VimMode): void {
  node.innerHTML = "";
  const label = document.createElement("span");
  label.textContent = `-- ${mode.toUpperCase()} --`;
  label.style.cssText =
    "font:600 11px ui-monospace,monospace;letter-spacing:0.5px;";
  node.appendChild(label);

  const palette: Record<string, { bg: string; fg: string; border: string }> = {
    normal: { bg: "#1d4ed8", fg: "#ffffff", border: "#1e40af" },
    insert: { bg: "#16a34a", fg: "#ffffff", border: "#15803d" },
    visual: { bg: "#a855f7", fg: "#ffffff", border: "#9333ea" },
    replace: { bg: "#f59e0b", fg: "#1f2937", border: "#d97706" },
    command: { bg: "#0f172a", fg: "#fbbf24", border: "#1e293b" },
  };
  const key = String(mode).toLowerCase();
  const colors = palette[key] ?? { bg: "#3f3f46", fg: "#fafafa", border: "#52525b" };
  node.style.background = colors.bg;
  node.style.color = colors.fg;
  node.style.border = `1px solid ${colors.border}`;
  node.style.boxShadow = "0 4px 12px rgba(0,0,0,0.18)";
  emitMode(String(mode).toLowerCase());
}

function watchStatusBar(node: HTMLElement, onMode: (m: VimMode) => void): MutationObserver {
  let last = "";
  const tick = () => {
    const txt = (node.textContent ?? "").trim();
    if (txt !== last) {
      last = txt;
      const m = txt.match(/--\s*(\w+)\s*--/i);
      const mode: VimMode = m ? m[1].toLowerCase() : "normal";
      onMode(mode);
    }
  };
  const obs = new MutationObserver(tick);
  obs.observe(node, { childList: true, characterData: true, subtree: true });
  tick();
  return obs;
}

export async function attachVimMode(
  editor: import("monaco-editor").editor.IStandaloneCodeEditor,
  monaco: typeof import("monaco-editor"),
): Promise<VimModeHandle | null> {
  if (activeHandle) activeHandle.dispose();

  const init = await loadVimInit();
  if (!init) return null;

  const statusBar = document.createElement("div");
  statusBar.className = "zxai-vim-statusbar";
  statusBar.setAttribute("data-vim-statusbar", "1");
  statusBar.style.cssText =
    "position:fixed;bottom:18px;right:18px;z-index:50;padding:4px 10px;border-radius:8px;" +
    "background:#3f3f46;color:#fafafa;font:600 11px ui-monospace,monospace;letter-spacing:0.5px;" +
    "pointer-events:none;transition:background 0.15s ease,color 0.15s ease;";
  document.body.appendChild(statusBar);

  let adapter: VimAdapterInstance | null = null;
  try {
    adapter = init(editor, statusBar);
  } catch (e) {
    console.warn("[vim] initVimMode falló:", e);
    statusBar.remove();
    return null;
  }
  if (!adapter) {
    statusBar.remove();
    return null;
  }

  let currentMode: VimMode = "normal";

  const obs = watchStatusBar(statusBar, (m) => {
    currentMode = m;
    styleStatusBar(statusBar, m);
  });

  void monaco;

  /**
   * Llama directamente a `adapter.handleKeyDown` con un mock de IKeyboardEvent
   * de Monaco. Esto evita el ciclo de eventos del DOM (que en Android WebView
   * puede no propagar synthetic events correctamente) y va directo al
   * procesador vim. monaco-vim acepta `e.key` (string) para identificar la
   * tecla, así que sólo necesitamos `key` + un `browserEvent` con
   * `defaultPrevented: false`.
   *
   * Mapeo de modo a secuencia de teclas:
   *   normal ← Esc     (desde insert/visual)
   *   insert ← i       (desde normal)
   *   visual ← v       (desde normal)
   */
  const dispatchKey = (key: string) => {
    if (!adapter) return;
    try {
      const mock = {
        key,
        keyCode: 0,
        browserEvent: { defaultPrevented: false },
        _browserEvent: { defaultPrevented: false, key, code: "" },
      };
      adapter.handleKeyDown(mock);
    } catch (e) {
      console.warn("[vim] handleKeyDown falló para", key, e);
    }
  };

  const enterMode = (mode: VimMode) => {
    editor.focus();
    const cur = currentMode;
    if (cur === mode) return;
    if (mode === "normal") {
      dispatchKey("Escape");
    } else if (mode === "insert") {
      if (cur !== "normal") {
        dispatchKey("Escape");
      }
      dispatchKey("i");
    } else if (mode === "visual") {
      if (cur !== "normal") {
        dispatchKey("Escape");
      }
      dispatchKey("v");
    }
  };

  const handle: VimModeHandle = {
    statusBar,
    getMode: () => currentMode,
    setMode: (mode) => {
      enterMode(mode);
      currentMode = mode;
      styleStatusBar(statusBar, mode);
    },
    setCurrentMode: (mode) => {
      currentMode = mode;
    },
    dispose: () => {
      try {
        adapter?.dispose();
      } catch {
        /* ignore */
      }
      obs.disconnect();
      statusBar.remove();
      if (activeHandle === handle) {
        activeHandle = null;
        activeEditor = null;
      }
    },
  };

  activeHandle = handle;
  activeEditor = editor;
  return handle;
}
