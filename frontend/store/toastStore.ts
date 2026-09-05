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
const MAX_QUEUE = 8;
const timers = new Map<string, number>();
/** Waiting toasts — only one is visible at a time. */
let pending: AppToast[] = [];

function clearTimer(id: string) {
  const t = timers.get(id);
  if (t != null) {
    window.clearTimeout(t);
    timers.delete(id);
  }
}

function armTimer(get: () => ToastStore, toast: AppToast) {
  if (typeof window === "undefined" || toast.durationMs <= 0) return;
  clearTimer(toast.id);
  timers.set(
    toast.id,
    window.setTimeout(() => {
      timers.delete(toast.id);
      get().dismiss(toast.id);
    }, toast.durationMs),
  );
}

function upsertPending(toast: AppToast) {
  pending = [...pending.filter((t) => t.id !== toast.id), toast].slice(-MAX_QUEUE);
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
    const current = get().toasts[0];
    if (current && current.id !== id) {
      upsertPending(toast);
      return id;
    }
    pending = pending.filter((t) => t.id !== id);
    clearTimer(id);
    set({ toasts: [toast] });
    armTimer(get, toast);
    return id;
  },
  dismiss: (id) => {
    clearTimer(id);
    const current = get().toasts[0];
    if (current?.id !== id) {
      pending = pending.filter((t) => t.id !== id);
      return;
    }
    const next = pending.shift() ?? null;
    set({ toasts: next ? [next] : [] });
    if (next) armTimer(get, next);
  },
  clear: () => {
    for (const timerId of timers.keys()) clearTimer(timerId);
    pending = [];
    set({ toasts: [] });
  },
}));
