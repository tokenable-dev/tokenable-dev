import { create } from "zustand";

export type AuthModalMode = "sign-in" | "sign-up";

export type AuthBanner = {
  tone: "success" | "error" | "info";
  title: string;
  body?: string;
};

interface AuthUiState {
  signInOpen: boolean;
  signInMode: AuthModalMode;
  signInEmailFormOpen: boolean;
  authBanner: AuthBanner | null;
  connectWalletOpen: boolean;
  walletMismatchOpen: boolean;
  kycOpen: boolean;
  /** Route to open after auth / wallet / KYC completes */
  pendingReturnTo: string | null;

  openSignIn: (opts?: {
    mode?: AuthModalMode;
    returnTo?: string;
    openEmailForm?: boolean;
    banner?: AuthBanner | null;
  }) => void;
  openSignUp: (opts?: { returnTo?: string }) => void;
  closeSignIn: () => void;
  clearAuthBanner: () => void;
  openConnectWallet: (opts?: { returnTo?: string }) => void;
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
  signInEmailFormOpen: false,
  authBanner: null,
  connectWalletOpen: false,
  walletMismatchOpen: false,
  kycOpen: false,
  pendingReturnTo: null,

  openSignIn: (opts) =>
    set({
      signInOpen: true,
      signInMode: opts?.mode ?? "sign-in",
      signInEmailFormOpen: opts?.openEmailForm ?? false,
      authBanner: opts?.banner !== undefined ? opts.banner : get().authBanner,
      pendingReturnTo: opts?.returnTo ?? get().pendingReturnTo,
    }),

  openSignUp: (opts) =>
    set({
      signInOpen: true,
      signInMode: "sign-up",
      signInEmailFormOpen: false,
      authBanner: null,
      pendingReturnTo: opts?.returnTo ?? get().pendingReturnTo,
    }),

  closeSignIn: () =>
    set({
      signInOpen: false,
      signInEmailFormOpen: false,
      authBanner: null,
    }),

  clearAuthBanner: () => set({ authBanner: null }),

  openConnectWallet: (opts) =>
    set({
      connectWalletOpen: true,
      pendingReturnTo: opts?.returnTo ?? get().pendingReturnTo,
    }),

  closeConnectWallet: () => set({ connectWalletOpen: false }),

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
