"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils/cn";

export function ResizeHandle({
  direction,
  onDrag,
}: {
  direction: "horizontal" | "vertical";
  onDrag: (delta: number) => void;
}) {
  const last = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      last.current = direction === "horizontal" ? e.clientX : e.clientY;
    },
    [direction],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
      const pos = direction === "horizontal" ? e.clientX : e.clientY;
      const delta = pos - last.current;
      last.current = pos;
      onDrag(delta);
    },
    [direction, onDrag],
  );

  return (
    <div
      role="separator"
      aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      className={cn(
        "z-10 shrink-0 bg-transparent hover:bg-zinc-400/40 dark:hover:bg-zinc-500/40",
        direction === "horizontal" ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize",
      )}
    />
  );
}
