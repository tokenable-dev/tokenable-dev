"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { SellFlowView } from "@/components/sell/SellFlowView";
import { redirectGuestFromProtectedRoute } from "@/lib/auth/redirectGuestFromProtectedRoute";
import { userHasLinkedWallet } from "@/lib/auth/wallets";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";
import { VaultHubHeader } from "@/components/vault/hub/VaultHubHeader";
import {
  useVaultHubSubmissions,
  useVaultHubViewState,
  VaultActiveDashboardView,
} from "@/components/vault/hub/VaultActiveDashboardView";

function VaultHubPending() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div
        className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--azure)]/30 border-t-[var(--azure)]"
        aria-label="Loading"
      />
    </div>
  );
}

export function VaultHubView() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);
  const openConnectWallet = useAuthUiStore((s) => s.openConnectWallet);
  const submissionsQ = useVaultHubSubmissions();
  const viewState = useVaultHubViewState();
  const { ready, authenticated } = usePrivy();
  const [sessionWaitTimedOut, setSessionWaitTimedOut] = useState(false);
  const promptedWallet = useRef(false);
  const sessionCatchingUp = ready && authenticated && !user && !sessionWaitTimedOut;
  const hasWallet = userHasLinkedWallet(user);

  useEffect(() => {
    if (!ready || !authenticated || user) {
      setSessionWaitTimedOut(false);
      return;
    }
    const t = window.setTimeout(() => setSessionWaitTimedOut(true), 8000);
    return () => window.clearTimeout(t);
  }, [ready, authenticated, user]);

  useEffect(() => {
    if (hasWallet) promptedWallet.current = false;
  }, [hasWallet]);

  // Guests leave to landing — Sell nav opens Privy with returnTo=/vault instead.
  useEffect(() => {
    if (!initialized || loading || !ready || sessionCatchingUp || user || authenticated) {
      return;
    }
    if (!redirectGuestFromProtectedRoute(router, pathname || "/vault")) {
      router.replace("/");
    }
  }, [
    authenticated,
    initialized,
    loading,
    pathname,
    ready,
    router,
    sessionCatchingUp,
    user,
  ]);

  useEffect(() => {
    if (!initialized || loading || !ready || sessionCatchingUp || !user || hasWallet) return;
    if (promptedWallet.current) return;
    promptedWallet.current = true;
    openConnectWallet({ returnTo: "/vault" });
  }, [
    hasWallet,
    initialized,
    loading,
    openConnectWallet,
    ready,
    sessionCatchingUp,
    user,
  ]);

  if (
    !initialized ||
    loading ||
    sessionCatchingUp ||
    !user ||
    !hasWallet ||
    viewState === "loading"
  ) {
    return <VaultHubPending />;
  }

  if (viewState === "empty" && !submissionsQ.isError) {
    return (
      <Suspense fallback={<VaultHubPending />}>
        <SellFlowView />
      </Suspense>
    );
  }

  return (
    <>
      <VaultHubHeader />
      <VaultActiveDashboardView />
    </>
  );
}
