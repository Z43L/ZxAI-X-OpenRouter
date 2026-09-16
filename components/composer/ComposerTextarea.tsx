"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

export const ComposerTextarea = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    expanded: boolean;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    placeholder?: string;
    className?: string;
  }
>(function ComposerTextarea(
  { value, expanded, onChange, onSubmit, onFocus, onBlur, placeholder = "Pregunta cualquier cosa...", className },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => innerRef.current!);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (expanded) {
      el.style.height = "";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value, expanded]);

  return (
    <textarea
      ref={innerRef}
      value={value}
      rows={1}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onSubmit();
        }
      }}
        className={cn(
          "w-full resize-none border-0 bg-transparent px-4 pt-3 pb-1 text-[15px] leading-relaxed outline-none placeholder:text-zinc-400 dark:text-zinc-100",
          expanded ? "min-h-0 flex-1 overflow-y-auto" : "min-h-[28px] max-h-[240px] overflow-y-auto",
          className,
        )}
    />
  );
});
