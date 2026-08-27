import { create } from "zustand";
import type { AuthUser } from "@/lib/auth";
import { fetchAuthMe, logoutAuth } from "@/lib/auth";
import { fetchKycStatus } from "@/lib/kyc/api";
import { userHasLinkedWallet } from "@/lib/auth/wallets";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  setUser: (u: AuthUser | null) => void;
  refresh: (options?: { showLoading?: boolean }) => Promise<void>;
  /** Apply a session user and reconcile KYC from Sumsub (Privy sync path). */
  hydrateFromSession: (sessionUser: AuthUser) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

/** Prefer keeping linked wallets when a stale session response arrives without them. */
function mergeAuthUser(prev: AuthUser | null, next: AuthUser | null): AuthUser | null {
  if (!next) return null;
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
  setUser: (user) =>
    set({ user: mergeAuthUser(get().user, user), initialized: true, loading: false }),
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
      const user = sessionUser ? await syncKycFromSumsub(sessionUser) : null;
      // Stale GET /auth/session can finish after PrivySessionBridge already linked wallets.
      set({ user: mergeAuthUser(get().user, user), initialized: true });
    } catch {
      set({ user: null, initialized: true });
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
