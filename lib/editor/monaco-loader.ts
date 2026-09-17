/**
 * Configura el loader de @monaco-editor/react para usar la instancia local de
 * monaco-editor (npm) en lugar de la del CDN. monaco-vim importa submódulos
 * `monaco-editor/esm/vs/...` que no están expuestos por el `exports` field
 * del paquete, por lo que necesitamos una instancia única y consistente.
 *
 * El módulo NO realiza side-effects al importarse. La inicialización ocurre
 * sólo en el navegador, en `ensureMonacoConfigured()`.
 */

let configured = false;
let configuring = false;

export async function ensureMonacoConfigured(): Promise<void> {
  if (typeof window === "undefined") return;
  if (configured) return;
  if (configuring) return;
  configuring = true;

  try {
    const [{ loader }, monaco] = await Promise.all([
      import("@monaco-editor/react"),
      import("monaco-editor"),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (loader as any).config({ monaco });
    configured = true;
    if (process.env.NODE_ENV !== "production") {
      console.info("[monaco-loader] monaco local configurado");
    }
  } catch (e) {
    console.warn("[monaco-loader] no se pudo configurar monaco local, sigo con CDN:", e);
  } finally {
    configuring = false;
  }
}
