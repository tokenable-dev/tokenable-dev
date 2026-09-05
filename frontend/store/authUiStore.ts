import { create } from "zustand";
import { rememberKycReturnTo } from "@/lib/kyc/returnPath";

export type AuthModalMode = "sign-in" | "sign-up";

export type ConnectWalletIntent = "session" | "link";

/** Survives OAuth full-page redirects (Google etc.) — Zustand alone does not. */
const AUTH_RETURN_TO_KEY = "tk_auth_return_to";

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

interface AuthUiState {
  signInOpen: boolean;
  signInMode: AuthModalMode;
  connectWalletOpen: boolean;
  /** Activates linked wallet (`session`) or opens Privy link flow (`link`). */
  connectWalletIntent: ConnectWalletIntent;
  walletMismatchOpen: boolean;
  kycOpen: boolean;
  pendingReturnTo: string | null;

  openSignIn: (opts?: { mode?: AuthModalMode; returnTo?: string }) => void;
  closeSignIn: () => void;
  openConnectWallet: (opts?: {
    returnTo?: string;
    intent?: ConnectWalletIntent;
  }) => void;
  closeConnectWallet: () => void;
  openWalletMismatch: (opts?: { returnTo?: string }) => void;
  closeWalletMismatch: () => void;
  openKyc: (opts?: { returnTo?: string }) => void;
  closeKyc: () => void;
  /** Set post-auth destination (also used when bypassing open* helpers). */
  setPendingReturnTo: (path: string | null) => void;
  consumeReturnTo: () => string | null;
}

export const useAuthUiStore = create<AuthUiState>((set, get) => ({
  signInOpen: false,
  signInMode: "sign-in",
  connectWalletOpen: false,
  connectWalletIntent: "session",
  walletMismatchOpen: false,
  kycOpen: false,
  // Prefer in-memory; sessionStorage is the OAuth-reload fallback (see consumeReturnTo).
  pendingReturnTo: null,

  openSignIn: (opts) =>
    set({
      signInOpen: true,
      signInMode: opts?.mode ?? "sign-in",
      pendingReturnTo: resolvePendingReturnTo(opts?.returnTo, get().pendingReturnTo),
    }),

  closeSignIn: () => set({ signInOpen: false }),

  openConnectWallet: (opts) =>
    set({
      connectWalletOpen: true,
      connectWalletIntent: opts?.intent ?? "session",
      pendingReturnTo: resolvePendingReturnTo(opts?.returnTo, get().pendingReturnTo),
    }),

  closeConnectWallet: () =>
    set({ connectWalletOpen: false, connectWalletIntent: "session" }),

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
}));
