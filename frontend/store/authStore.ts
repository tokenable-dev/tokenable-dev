import { create } from "zustand";
import type { AuthUser } from "@/lib/auth";
import { fetchAuthMe, logoutAuth } from "@/lib/auth";
import { userHasLinkedWallet } from "@/lib/auth/wallets";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  setUser: (u: AuthUser | null) => void;
  refresh: (options?: { showLoading?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
}

/** Prefer keeping linked wallets when a stale session response arrives without them. */
function mergeAuthUser(prev: AuthUser | null, next: AuthUser | null): AuthUser | null {
  if (!next) return null;
  if (
    prev &&
    prev.id === next.id &&
    userHasLinkedWallet(prev) &&
    !userHasLinkedWallet(next)
  ) {
    return {
      ...next,
      wallets: prev.wallets,
      walletAddress: prev.walletAddress,
      walletLinkedAt: prev.walletLinkedAt,
    };
  }
  return next;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  initialized: false,
  setUser: (user) => set({ user, initialized: true, loading: false }),
  refresh: async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading !== false;
    if (showLoading) set({ loading: true });
    try {
      const user = await fetchAuthMe();
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
