import { create } from "zustand";

export type AuthModalMode = "sign-in" | "sign-up";

export type ConnectWalletIntent = "session" | "link";

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
  openSignUp: (opts?: { returnTo?: string }) => void;
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
  consumeReturnTo: () => string | null;
}

export const useAuthUiStore = create<AuthUiState>((set, get) => ({
  signInOpen: false,
  signInMode: "sign-in",
  connectWalletOpen: false,
  connectWalletIntent: "session",
  walletMismatchOpen: false,
  kycOpen: false,
  pendingReturnTo: null,

  openSignIn: (opts) =>
    set({
      signInOpen: true,
      signInMode: opts?.mode ?? "sign-in",
      pendingReturnTo: opts?.returnTo ?? get().pendingReturnTo,
    }),

  openSignUp: (opts) =>
    set({
      signInOpen: true,
      signInMode: "sign-up",
      pendingReturnTo: opts?.returnTo ?? get().pendingReturnTo,
    }),

  closeSignIn: () => set({ signInOpen: false }),

  openConnectWallet: (opts) =>
    set({
      connectWalletOpen: true,
      connectWalletIntent: opts?.intent ?? "session",
      pendingReturnTo: opts?.returnTo ?? get().pendingReturnTo,
    }),

  closeConnectWallet: () =>
    set({ connectWalletOpen: false, connectWalletIntent: "session" }),

  openWalletMismatch: (opts) =>
    set({
      walletMismatchOpen: true,
      pendingReturnTo: opts?.returnTo ?? get().pendingReturnTo,
    }),

  closeWalletMismatch: () => set({ walletMismatchOpen: false }),

  openKyc: (opts) =>
    set({
      kycOpen: true,
      pendingReturnTo: opts?.returnTo ?? get().pendingReturnTo,
    }),

  closeKyc: () => set({ kycOpen: false }),

  consumeReturnTo: () => {
    const path = get().pendingReturnTo;
    set({ pendingReturnTo: null });
    return path;
  },
}));
