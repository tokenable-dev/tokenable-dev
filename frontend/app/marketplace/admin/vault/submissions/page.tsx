import { Suspense } from "react";
import { MarketplaceAdminVaultSubmissionsPage } from "@/components/marketplace/admin/MarketplaceAdminVaultSubmissionsPage";

export default function MarketplaceAdminVaultSubmissionsRoute() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <MarketplaceAdminVaultSubmissionsPage />
    </Suspense>
  );
}
