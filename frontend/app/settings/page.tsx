"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { shouldDeferGuestSignIn } from "@/lib/auth/privySessionGate";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

function SettingsPageGate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const initialized = useAuthStore((s) => s.initialized);
  const privySessionSyncing = useAuthStore((s) => s.privySessionSyncing);
  const { ready: privyReady, authenticated: privyAuthenticated } = usePrivy();
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const prompted = useRef(false);

  const query = searchParams.toString();
  const returnTo = query ? `${pathname}?${query}` : pathname || "/settings";

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
    openSignIn({ returnTo });
    router.replace("/");
  }, [
    initialized,
    loading,
    user,
    privyReady,
    privyAuthenticated,
    privySessionSyncing,
    openSignIn,
    returnTo,
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

  if (!user) return null;

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
