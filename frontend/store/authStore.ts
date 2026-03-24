import { create } from "zustand";
import type { AuthUser } from "@/lib/auth";
import { fetchAuthMe, logoutAuth } from "@/lib/auth";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  setUser: (u: AuthUser | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  initialized: false,
  setUser: (user) => set({ user }),
  refresh: async () => {
    set({ loading: true });
    try {
      const user = await fetchAuthMe();
      set({ user, initialized: true });
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
