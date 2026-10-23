"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { shouldDeferGuestSignIn } from "@/lib/auth";
import { redirectGuestFromProtectedRoute } from "@/lib/auth/redirectGuestFromProtectedRoute";
import { useAuthStore } from "@/store/authStore";

/**
 * Vault routes require a Tokenable session (Privy sign-in).
 * Guests who land on a vault URL directly are sent back and prompted to sign in.
 */
export function VaultAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);
  const privySessionSyncing = useAuthStore((s) => s.privySessionSyncing);
  const { ready: privyReady, authenticated: privyAuthenticated } = usePrivy();
  const pathname = usePathname();
  const redirected = useRef(false);

  useEffect(() => {
    if (
      shouldDeferGuestSignIn({
        authInitialized: initialized,
        authLoading: loading,
        user,
        privyReady,
        privyAuthenticated,
        privySessionSyncing,
      }) ||
      redirected.current
    ) {
      return;
    }
    redirected.current = true;
    if (!redirectGuestFromProtectedRoute(router, pathname)) {
      router.replace("/markets");
    }
  }, [
    initialized,
    loading,
    user,
    privyReady,
    privyAuthenticated,
    privySessionSyncing,
    pathname,
    router,
  ]);

  useEffect(() => {
    if (user) redirected.current = false;
  }, [user]);

  if (!initialized || loading || privySessionSyncing || (privyAuthenticated && !user)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div
          className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--azure)]/30 border-t-[var(--azure)]"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
