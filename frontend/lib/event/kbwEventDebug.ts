/**
 * KBW Stage-2 diagnostics — enable on staging/prod with:
 *   NEXT_PUBLIC_KBW_EVENT_DEBUG=true
 * Filter device logs with `[KBW]`. Never log tokens or full emails.
 */
import { isWalletOnlyPlaceholderEmail } from "@/lib/auth/walletOnlyEmail";
import { isKbwEventActive } from "@/lib/event/kbwEventPeriod";
import {
  isKbwEventStage2PostLoginActive,
  isKbwPostLoginRoutePending,
  isKbwStage2FlowPending,
  KBW_LOGIN_INTENT_KEY,
  KBW_POST_LOGIN_ROUTE_KEY,
  KBW_STAGE2_FLOW_KEY,
} from "@/lib/event/kbwEventLoginRouting";
import { appendKbwDebugLine } from "@/lib/event/kbwEventDebugBuffer";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

const KBW_OFFER_PENDING_KEY = "tk_kbw_offer_pending";

const LOG_PREFIX = "[KBW]";

export function isKbwEventDebugEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_KBW_EVENT_DEBUG?.trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  return process.env.NODE_ENV === "development";
}

export function maskEmail(email: string | null | undefined): string {
  if (!email?.trim()) return "(none)";
  const e = email.trim().toLowerCase();
  const at = e.indexOf("@");
  if (at <= 0) return "***";
  return `${e.slice(0, 1)}***${e.slice(at)}`;
}

export function shortWallet(address: string | null | undefined): string {
  if (!address?.trim()) return "(none)";
  const w = address.trim();
  if (w.length < 12) return w;
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

function readStorageFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(key) === "1") return true;
    if (localStorage.getItem(key) === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Redacted snapshot for correlating mobile MetaMask return issues. */
export function kbwDebugSnapshot() {
  const auth = useAuthStore.getState();
  const ui = useAuthUiStore.getState();
  const user = auth.user;
  return {
    path: typeof window !== "undefined" ? window.location.pathname : "",
    href: typeof window !== "undefined" ? window.location.href.split("?")[0] : "",
    visibility:
      typeof document !== "undefined" ? document.visibilityState : "unknown",
    eventActive: isKbwEventActive(),
    flags: {
      stage2Flow: isKbwStage2FlowPending(),
      postLoginRoute: isKbwPostLoginRoutePending(),
      stage2PostLoginActive: isKbwEventStage2PostLoginActive(),
      loginIntent: readStorageFlag(KBW_LOGIN_INTENT_KEY),
      offerPendingStorage: readStorageFlag(KBW_OFFER_PENDING_KEY),
    },
    ui: {
      kbwOfferPending: ui.kbwOfferPending,
      signInOpen: ui.signInOpen,
      pendingReturnTo: ui.pendingReturnTo,
      walletActivationPhase: ui.walletActivationPhase,
    },
    auth: {
      initialized: auth.initialized,
      loading: auth.loading,
      privySessionSyncing: auth.privySessionSyncing,
      userId: user?.id ?? null,
      email: maskEmail(user?.email),
      walletOnly: isWalletOnlyPlaceholderEmail(user?.email),
      wallet: shortWallet(user?.walletAddress ?? null),
    },
  };
}

export function kbwDebug(step: string, detail?: Record<string, unknown>): void {
  if (!isKbwEventDebugEnabled()) return;
  const payload = detail ? { ...kbwDebugSnapshot(), ...detail } : kbwDebugSnapshot();
  appendKbwDebugLine(step, payload as Record<string, unknown>);
  console.log(`${LOG_PREFIX} ${step}`, payload);
}

/** Keys for grep — documented for support handoff. */
export const KBW_DEBUG_STORAGE_KEYS = {
  stage2: KBW_STAGE2_FLOW_KEY,
  postLogin: KBW_POST_LOGIN_ROUTE_KEY,
  loginIntent: KBW_LOGIN_INTENT_KEY,
  offerPending: KBW_OFFER_PENDING_KEY,
} as const;
