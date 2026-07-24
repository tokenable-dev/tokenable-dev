"use client";

import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";
import { VaultEmptyDashboardView } from "@/components/vault/hub/VaultEmptyDashboardView";
import { VaultHubHeader } from "@/components/vault/hub/VaultHubHeader";
import { VaultLandingView } from "@/components/vault/hub/VaultLandingViews";

export function VaultHubView() {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);
  const openSignIn = useAuthUiStore((s) => s.openSignIn);

  if (!initialized || loading) {
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
    return <VaultLandingView onSignIn={() => openSignIn({ returnTo: "/vault" })} />;
  }

  return (
    <>
      <VaultHubHeader />
      <VaultEmptyDashboardView />
    </>
  );
}
