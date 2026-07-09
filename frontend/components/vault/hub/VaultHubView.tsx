"use client";

import { useMemo, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";
import { hasVaultActiveProcesses } from "@/lib/vault/vaultMockData";
import { VaultDashboardView } from "@/components/vault/hub/VaultDashboardView";
import { VaultEmptyDashboardView } from "@/components/vault/hub/VaultEmptyDashboardView";
import { VaultHubHeader } from "@/components/vault/hub/VaultHubHeader";
import { VaultLandingView } from "@/components/vault/hub/VaultLandingViews";
import { VaultStateToggle, type VaultHubMode } from "@/components/vault/hub/VaultStateToggle";

export function VaultHubView() {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const hasActiveProcesses = hasVaultActiveProcesses();
  const [devOverride, setDevOverride] = useState<VaultHubMode | null>(null);

  const viewMode: VaultHubMode = useMemo(() => {
    if (devOverride) return devOverride;
    return hasActiveProcesses ? "active" : "empty";
  }, [devOverride, hasActiveProcesses]);

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
      {viewMode === "empty" ? <VaultEmptyDashboardView /> : <VaultDashboardView />}
      <VaultStateToggle value={viewMode} onChange={setDevOverride} />
    </>
  );
}
