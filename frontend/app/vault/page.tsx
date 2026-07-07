"use client";

import { Suspense, useEffect } from "react";
import type { ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { VaultPageBody } from "@/components/vault/VaultPageBody";
import { VaultRouteGuard } from "@/components/vault/VaultRouteGuard";

/** Legacy `/vault?tab=my-rwa` → `/portfolio` (My Assets). */
function LegacyVaultTabRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("tab") === "my-rwa") {
      router.replace("/portfolio");
    }
  }, [searchParams, router]);

  return null;
}

export default function VaultPage() {
  return (
    <div className="vault-page">
      <Suspense fallback={null}>
        <LegacyVaultTabRedirect />
      </Suspense>

      <VaultRouteGuard>
        <div className="vault-page__shell">
          <VaultPageBody />
        </div>
      </VaultRouteGuard>
    </div>
  );
}
