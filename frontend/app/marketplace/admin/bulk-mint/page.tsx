import { Suspense } from "react";
import { MarketplaceAdminBulkMintPage } from "@/components/marketplace/admin/MarketplaceAdminBulkMintPage";

export default function MarketplaceAdminBulkMintRoute() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading…</p>}>
      <MarketplaceAdminBulkMintPage />
    </Suspense>
  );
}
