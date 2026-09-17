"use client";

import { Download } from "lucide-react";
import type { MessageAudio, MessageImage, MessageVideo } from "@/types/media";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function InlineImage({ image, index }: { image: MessageImage; index: number }) {
  const href = image.dataUrl ?? image.url;
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block max-w-sm overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={href}
        alt={image.format ?? `image ${index}`}
        className="h-auto max-h-[480px] w-full object-contain"
      />
      {image.bytes !== undefined && (
        <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 group-hover:opacity-100">
          {Math.round(image.bytes / 1024)} KB
        </span>
      )}
    </a>
  );
}

export function InlineAudio({ audio }: { audio: MessageAudio }) {
  const href = audio.dataUrl ?? audio.url;
  if (!href) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <audio controls src={href} className="w-full" preload="metadata" />
      {audio.transcript && (
        <p className="mt-2 text-[12px] italic text-zinc-500 dark:text-zinc-400">
          &ldquo;{audio.transcript}&rdquo;
        </p>
      )}
    </div>
  );
}

export function InlineVideo({ video }: { video: MessageVideo }) {
  if (!video.url && !video.dataUrl) return null;
  const src = video.dataUrl ?? video.url ?? "";
  return (
    <video
      controls
      src={src}
      className="max-h-[480px] w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-700"
      preload="metadata"
    />
  );
}

export function MediaActions({
  image,
  audio,
  video,
  filenameBase,
}: {
  image?: MessageImage;
  audio?: MessageAudio;
  video?: MessageVideo;
  filenameBase: string;
}) {
  if (image?.dataUrl) {
    return (
      <button
        type="button"
        onClick={async () => {
          const blob = await (await fetch(image.dataUrl!)).blob();
          downloadBlob(blob, `${filenameBase}.${image.format ?? "png"}`);
        }}
        className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <Download className="h-3 w-3" /> Descargar
      </button>
    );
  }
  if (audio?.dataUrl) {
    return (
      <button
        type="button"
        onClick={async () => {
          const blob = await (await fetch(audio.dataUrl!)).blob();
          downloadBlob(blob, `${filenameBase}.${audio.format ?? "wav"}`);
        }}
        className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <Download className="h-3 w-3" /> Descargar audio
      </button>
    );
  }
  if (video?.url) {
    return (
      <a
        href={video.url}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <Download className="h-3 w-3" /> Descargar vídeo
      </a>
    );
  }
  return null;
}
