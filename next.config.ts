import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  transpilePackages: ["monaco-editor", "@monaco-editor/react"],
};

export default nextConfig;
