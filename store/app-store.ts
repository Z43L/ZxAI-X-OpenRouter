import { create } from "zustand";
import type { AppMode } from "@/types/code";

const MODE_KEY = "chatai.appmode.v1";

interface AppState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

function readMode(): AppMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "code" ? "code" : "chat";
  } catch {
    return "chat";
  }
}

export const useAppStore = create<AppState>()((set) => ({
  mode: typeof window !== "undefined" ? readMode() : "chat",
  setMode: (mode) => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* ignore */
    }
    set({ mode });
  },
}));
