import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  transpilePackages: ["monaco-editor", "@monaco-editor/react", "monaco-vim"],
  // Alias para que monaco-vim (que importa submódulos de monaco-editor
  // no expuestos por su `exports` field) los resuelva desde el paquete npm.
  // Usamos rutas relativas a la raíz del proyecto para que Turbopack las
  // acepte (no resuelve archivos fuera del project root).
  turbopack: {
    resolveAlias: {
      "monaco-editor/esm/vs/editor/editor.api":
        "./node_modules/monaco-editor/esm/vs/editor/editor.api.js",
      "monaco-editor/esm/vs/editor/common/commands/shiftCommand":
        "./node_modules/monaco-editor/esm/vs/editor/common/commands/shiftCommand.js",
    },
  },
};

export default nextConfig;
const _paths = [
  path.resolve(__dirname, "node_modules/monaco-editor/esm/vs/editor/editor.api.js"),
  path.resolve(__dirname, "node_modules/monaco-editor/esm/vs/editor/common/commands/shiftCommand.js"),
];
void _paths;
