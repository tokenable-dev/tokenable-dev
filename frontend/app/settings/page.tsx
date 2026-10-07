"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { shouldDeferGuestSignIn } from "@/lib/auth";
import { redirectGuestFromProtectedRoute } from "@/lib/auth/redirectGuestFromProtectedRoute";
import { useTokenableSessionActive } from "@/lib/auth/sessionActive";
import { useAuthStore } from "@/store/authStore";

function SettingsPageGate() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const initialized = useAuthStore((s) => s.initialized);
  const privySessionSyncing = useAuthStore((s) => s.privySessionSyncing);
  const { ready: privyReady, authenticated: privyAuthenticated } = usePrivy();
  const sessionActive = useTokenableSessionActive();
  const prompted = useRef(false);

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
      prompted.current
    ) {
      return;
    }
    prompted.current = true;
    redirectGuestFromProtectedRoute(router, pathname);
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
    if (user) prompted.current = false;
  }, [user]);

  if (
    !initialized ||
    loading ||
    privySessionSyncing ||
    (privyAuthenticated && !user)
  ) {
    return (
      <div className="secondary-page secondary-page--centered">
        <div className="secondary-spinner" aria-label="Loading settings" />
      </div>
    );
  }

  if (!sessionActive || !user) return null;

  return <SettingsPage user={user} />;
}

export default function SettingsRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="secondary-page secondary-page--centered">
          <div className="secondary-spinner" aria-label="Loading settings" />
        </div>
      }
    >
      <SettingsPageGate />
    </Suspense>
  );
}
