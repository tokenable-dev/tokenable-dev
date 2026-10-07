"use client";

import { Suspense } from "react";
import { AdminHomePreviewPanel } from "./AdminHomePreviewPanel";
import { ADMIN_TEXT_EMPTY } from "../adminUi";
import { MarketplaceAdminPageHeader } from "../MarketplaceAdminPageHeader";

function MarketplaceAdminMarketsPageContent() {
  return (
    <>
      <MarketplaceAdminPageHeader
        title="Markets preview"
        subtitle="Home landing rankings preview (admin only)."
      />
      <AdminHomePreviewPanel />
    </>
  );
}

export function MarketplaceAdminMarketsPage() {
  return (
    <Suspense fallback={<p className={`text-sm ${ADMIN_TEXT_EMPTY}`}>Loading…</p>}>
      <MarketplaceAdminMarketsPageContent />
    </Suspense>
  );
}
