"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { setNativeStatusBarStyle, initNativeKeyboardListeners } from "@/lib/mobile/native";

export function NativeInit() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const isDark = resolvedTheme === "dark";
    void setNativeStatusBarStyle(isDark);
  }, [resolvedTheme]);

  useEffect(() => {
    const cleanup = initNativeKeyboardListeners();
    return () => cleanup();
  }, []);

  return null;
}
