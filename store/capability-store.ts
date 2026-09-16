import { create } from "zustand";
import type { CapabilityNotice } from "@/lib/capabilities/reconcile";

interface ToastItem extends CapabilityNotice {
  id: number;
}

interface CapabilityUiState {
  toast: ToastItem | null;
  showToast: (title: string, body: string) => void;
  dismissToast: () => void;
}

let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useCapabilityStore = create<CapabilityUiState>()((set) => ({
  toast: null,

  showToast: (title, body) => {
    if (toastTimer) clearTimeout(toastTimer);
    const id = ++toastSeq;
    set({ toast: { id, title, body } });
    toastTimer = setTimeout(() => {
      set((s) => (s.toast?.id === id ? { toast: null } : s));
    }, 4200);
  },

  dismissToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: null });
  },
}));
