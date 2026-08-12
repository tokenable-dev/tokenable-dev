import { create } from "zustand";
import type { TkNoteTone } from "@/components/ds/Note";

export type AppToast = {
  id: string;
  tone: TkNoteTone;
  title: string;
  message: string;
  href?: string | null;
  ctaLabel?: string | null;
  /** When set, activating marks this inbox row read. */
  notificationId?: string;
  addFunds?: boolean;
  durationMs: number;
};

type ToastStore = {
  toasts: AppToast[];
  push: (toast: Omit<AppToast, "id" | "durationMs"> & {
    id?: string;
    durationMs?: number;
  }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const DEFAULT_DURATION_MS = 6_000;
const timers = new Map<string, number>();

function clearTimer(id: string) {
  const t = timers.get(id);
  if (t != null) {
    window.clearTimeout(t);
    timers.delete(id);
  }
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (input) => {
    const id =
      input.id?.trim() ||
      `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast: AppToast = {
      id,
      tone: input.tone,
      title: input.title,
      message: input.message,
      href: input.href,
      ctaLabel: input.ctaLabel,
      notificationId: input.notificationId,
      addFunds: input.addFunds,
      durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
    };
    clearTimer(id);
    set((s) => ({
      toasts: [...s.toasts.filter((t) => t.id !== id), toast].slice(-4),
    }));
    if (typeof window !== "undefined" && toast.durationMs > 0) {
      timers.set(
        id,
        window.setTimeout(() => {
          timers.delete(id);
          get().dismiss(id);
        }, toast.durationMs),
      );
    }
    return id;
  },
  dismiss: (id) => {
    clearTimer(id);
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  clear: () => {
    for (const id of timers.keys()) clearTimer(id);
    set({ toasts: [] });
  },
}));
