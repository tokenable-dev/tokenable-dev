import { create } from "zustand";
import { rememberKycReturnTo } from "@/lib/kyc/returnPath";
import type { WalletConnectErrorCode } from "@/lib/network/walletError";
import { useToastStore } from "@/store/toastStore";

export type AuthModalMode = "sign-in" | "sign-up";

/**
 * Survives PrivyWalletLauncher remount during MetaMask Mobile app-switch.
 * Do not rely on component useRef alone for duplicate-activation protection.
 */
export type WalletActivationPhase =
  | "idle"
  | "activating"
  | "waiting_mobile_return"
  | "reconciling"
  | "failed";

/** Survives OAuth full-page redirects (Google etc.) — Zustand alone does not. */
const AUTH_RETURN_TO_KEY = "tk_auth_return_to";
/** Survives remount / mobile viewport hydration so the KBW offer is not dropped. */
const KBW_OFFER_PENDING_KEY = "tk_kbw_offer_pending";

function readStoredReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const path = sessionStorage.getItem(AUTH_RETURN_TO_KEY);
    return path && path.startsWith("/") ? path : null;
  } catch {
    return null;
  }
}

function writeStoredReturnTo(path: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (path && path.startsWith("/")) {
      sessionStorage.setItem(AUTH_RETURN_TO_KEY, path);
    } else {
      sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

function readKbwOfferPending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(KBW_OFFER_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

function writeKbwOfferPending(pending: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (pending) sessionStorage.setItem(KBW_OFFER_PENDING_KEY, "1");
    else sessionStorage.removeItem(KBW_OFFER_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

function resolvePendingReturnTo(
  explicit: string | undefined,
  current: string | null,
): string | null {
  const next = explicit ?? current;
  if (next && next.startsWith("/")) {
    writeStoredReturnTo(next);
    return next;
  }
  return current;
}

export function isWalletActivationInFlight(phase: WalletActivationPhase): boolean {
  return (
    phase === "activating" ||
    phase === "waiting_mobile_return" ||
    phase === "reconciling"
  );
}

interface AuthUiState {
  signInOpen: boolean;
  signInMode: AuthModalMode;
  connectWalletOpen: boolean;
  walletMismatchOpen: boolean;
  kycOpen: boolean;
  /** Post-login KBW mystery-card offer (armed only during event window). */
  kbwOfferPending: boolean;
  pendingReturnTo: string | null;

  walletActivationPhase: WalletActivationPhase;
  walletActivationExpectedAddress: string | null;

  openSignIn: (opts?: { mode?: AuthModalMode; returnTo?: string }) => void;
  closeSignIn: () => void;
  openConnectWallet: (opts?: { returnTo?: string }) => void;
  closeConnectWallet: () => void;
  openWalletMismatch: (opts?: { returnTo?: string }) => void;
  closeWalletMismatch: () => void;
  openKyc: (opts?: { returnTo?: string }) => void;
  closeKyc: () => void;
  armKbwOffer: () => void;
  clearKbwOffer: () => void;
  /** Restore pending flag from sessionStorage after remount. */
  hydrateKbwOfferPending: () => void;
  /** Set post-auth destination (also used when bypassing open* helpers). */
  setPendingReturnTo: (path: string | null) => void;
  consumeReturnTo: () => string | null;

  /**
   * Begin a wallet activation attempt. Returns false when one is already in flight
   * (duplicate tap / remount) — caller must not open another Privy modal.
   */
  beginWalletActivation: (expectedAddress?: string | null) => boolean;
  setWalletActivationPhase: (phase: WalletActivationPhase) => void;
  failWalletActivation: (
    code: WalletConnectErrorCode,
    message: string,
  ) => void;
  finishWalletActivation: () => void;
  /** Clear in-flight connect/link so logout cannot resume a MetaMask prompt. */
  resetWalletActivation: () => void;
}

export const useAuthUiStore = create<AuthUiState>((set, get) => ({
  signInOpen: false,
  signInMode: "sign-in",
  connectWalletOpen: false,
  walletMismatchOpen: false,
  kycOpen: false,
  kbwOfferPending: false,
  pendingReturnTo: null,

  walletActivationPhase: "idle",
  walletActivationExpectedAddress: null,

  openSignIn: (opts) =>
    set({
      signInOpen: true,
      signInMode: opts?.mode ?? "sign-in",
      pendingReturnTo: resolvePendingReturnTo(opts?.returnTo, get().pendingReturnTo),
    }),

  closeSignIn: () => set({ signInOpen: false }),

  armKbwOffer: () => {
    writeKbwOfferPending(true);
    set({ kbwOfferPending: true });
  },
  clearKbwOffer: () => {
    writeKbwOfferPending(false);
    set({ kbwOfferPending: false });
  },

  /** Rehydrate pending offer after remount (OAuth / soft navigation). */
  hydrateKbwOfferPending: () => {
    if (readKbwOfferPending()) set({ kbwOfferPending: true });
  },

  openConnectWallet: (opts) => {
    const phase = get().walletActivationPhase;
    const pendingReturnTo = resolvePendingReturnTo(
      opts?.returnTo,
      get().pendingReturnTo,
    );
    if (isWalletActivationInFlight(phase)) {
      set({ pendingReturnTo });
      useToastStore.getState().push({
        tone: "warning",
        title: "Connecting wallet",
        message:
          "Wallet connection is already in progress. Finish the approval in your wallet, then try again.",
        durationMs: 6_000,
      });
      return;
    }
    set({
      connectWalletOpen: true,
      pendingReturnTo,
    });
  },

  closeConnectWallet: () => set({ connectWalletOpen: false }),

  openWalletMismatch: (opts) =>
    set({
      walletMismatchOpen: true,
      pendingReturnTo: resolvePendingReturnTo(opts?.returnTo, get().pendingReturnTo),
    }),

  closeWalletMismatch: () => set({ walletMismatchOpen: false }),

  openKyc: (opts) => {
    const pendingReturnTo = resolvePendingReturnTo(opts?.returnTo, get().pendingReturnTo);
    rememberKycReturnTo(pendingReturnTo);
    set({
      kycOpen: true,
      pendingReturnTo,
    });
  },

  closeKyc: () => set({ kycOpen: false }),

  setPendingReturnTo: (path) => {
    const next = path && path.startsWith("/") ? path : null;
    writeStoredReturnTo(next);
    set({ pendingReturnTo: next });
  },

  consumeReturnTo: () => {
    const path = get().pendingReturnTo ?? readStoredReturnTo();
    writeStoredReturnTo(null);
    set({ pendingReturnTo: null });
    return path && path.startsWith("/") ? path : null;
  },

  beginWalletActivation: (expectedAddress) => {
    if (isWalletActivationInFlight(get().walletActivationPhase)) return false;
    set({
      walletActivationPhase: "activating",
      walletActivationExpectedAddress: expectedAddress?.trim()
        ? expectedAddress.trim().toLowerCase()
        : null,
    });
    return true;
  },

  setWalletActivationPhase: (phase) => set({ walletActivationPhase: phase }),

  failWalletActivation: (_code, _message) =>
    set({
      walletActivationPhase: "failed",
      connectWalletOpen: false,
    }),

  finishWalletActivation: () =>
    set({
      walletActivationPhase: "idle",
      walletActivationExpectedAddress: null,
      connectWalletOpen: false,
    }),

  resetWalletActivation: () =>
    set({
      walletActivationPhase: "idle",
      walletActivationExpectedAddress: null,
      connectWalletOpen: false,
      walletMismatchOpen: false,
    }),
}));
