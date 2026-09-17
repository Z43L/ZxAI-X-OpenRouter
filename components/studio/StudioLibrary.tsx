"use client";

import { Download } from "lucide-react";
import type { StudioClip } from "@/types/studio";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeFor(fmt: string): string {
  switch (fmt) {
    case "mp3":
      return "audio/mpeg";
    case "flac":
      return "audio/flac";
    case "opus":
      return "audio/ogg; codecs=opus";
    case "pcm16":
      return "audio/pcm";
    default:
      return "audio/wav";
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function nativeSave(dataUrl: string, filename: string, mime: string): Promise<void> {
  const b64 = dataUrl.split(",")[1] ?? "";
  const u8 = base64ToBytes(b64);
  const { isNative, saveBytesNative } = await import("@/lib/mobile/fs");
  if (isNative) {
    await saveBytesNative(u8, filename, mime);
    return;
  }
  const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
  const blob = new Blob([buf], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function StudioLibrary({ clips }: { clips: StudioClip[] }) {
  if (clips.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-zinc-400">
        Aún no se han generado clips en esta sesión.
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((clip) => (
        <div
          key={clip.id}
          className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-400">#{clip.index + 1}</span>
            <p
              className="min-w-0 flex-1 truncate text-[13px] text-zinc-700 dark:text-zinc-200"
              title={clip.prompt}
            >
              {clip.prompt}
            </p>
          </div>
          <audio controls src={clip.dataUrl} className="w-full" preload="metadata" />
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span>{fmtBytes(clip.bytes)}</span>
            <span>{clip.model.split("/").pop()}</span>
            <button
              type="button"
              onClick={() =>
                void nativeSave(clip.dataUrl, `clip-${clip.index + 1}.${clip.format}`, mimeFor(clip.format))
              }
              className="ml-auto inline-flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <Download className="h-3 w-3" /> Guardar
            </button>
          </div>
          {clip.transcript && (
            <p className="line-clamp-2 text-[11px] italic text-zinc-500">
              &ldquo;{clip.transcript}&rdquo;
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
