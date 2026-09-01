import { create } from "zustand";
import type { AuthUser } from "@/lib/auth";
import { fetchAuthMe, logoutAuth } from "@/lib/auth";
import { fetchKycStatus } from "@/lib/kyc/api";
import { userHasLinkedWallet } from "@/lib/auth/wallets";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  /** True while PrivySessionBridge is exchanging a Privy token for the Tokenable cookie. */
  privySessionSyncing: boolean;
  setUser: (u: AuthUser | null) => void;
  setPrivySessionSyncing: (syncing: boolean) => void;
  refresh: (options?: { showLoading?: boolean }) => Promise<void>;
  /** Apply a session user and reconcile KYC from Sumsub (Privy sync path). */
  hydrateFromSession: (sessionUser: AuthUser) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

/**
 * Prefer keeping linked wallets / KYC when a stale session payload is thinner.
 * `next === null` must not wipe a user Privy already hydrated — GET /auth/session
 * often races POST /auth/privy/session and returns `{ user: null }`. Logout uses
 * `set({ user: null })` directly, not this merge.
 */
function mergeAuthUser(prev: AuthUser | null, next: AuthUser | null): AuthUser | null {
  if (!next) return prev;
  if (!prev || prev.id !== next.id) return next;
  let merged = next;
  if (userHasLinkedWallet(prev) && !userHasLinkedWallet(next)) {
    merged = {
      ...merged,
      wallets: prev.wallets,
      walletAddress: prev.walletAddress,
      walletLinkedAt: prev.walletLinkedAt,
    };
  }
  if (prev.kycStatus != null && next.kycStatus == null) {
    merged = {
      ...merged,
      kycStatus: prev.kycStatus,
      kycVerifiedAt: prev.kycVerifiedAt,
      kycProvider: prev.kycProvider,
    };
  }
  return merged;
}

async function syncKycFromSumsub(user: AuthUser): Promise<AuthUser> {
  try {
    const kyc = await fetchKycStatus();
    return {
      ...user,
      kycStatus: kyc.status,
      kycVerifiedAt: kyc.verifiedAt,
      kycProvider: kyc.provider ?? user.kycProvider,
    };
  } catch {
    return user;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  initialized: false,
  privySessionSyncing: false,
  setUser: (user) =>
    set({ user: mergeAuthUser(get().user, user), initialized: true, loading: false }),
  setPrivySessionSyncing: (privySessionSyncing) => set({ privySessionSyncing }),
  hydrateFromSession: async (sessionUser) => {
    const withKyc = await syncKycFromSumsub(sessionUser);
    const user = mergeAuthUser(get().user, withKyc);
    set({ user, initialized: true, loading: false });
    return user ?? withKyc;
  },
  refresh: async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading !== false;
    if (showLoading) set({ loading: true });
    try {
      const sessionUser = await fetchAuthMe();
      if (!sessionUser) {
        set({ initialized: true });
        return;
      }
      const user = await syncKycFromSumsub(sessionUser);
      set({ user: mergeAuthUser(get().user, user), initialized: true });
    } catch {
      set({ initialized: true });
    } finally {
      set({ loading: false });
    }
  },
  logout: async () => {
    try {
      await logoutAuth();
    } finally {
      set({ user: null });
    }
  },
}));
