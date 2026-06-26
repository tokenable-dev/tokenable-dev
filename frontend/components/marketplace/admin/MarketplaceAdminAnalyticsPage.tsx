"use client";

import { AdminGa4ExternalLink } from "./AdminGa4ExternalLink";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

export function MarketplaceAdminAnalyticsPage() {
  return (
    <>
      <MarketplaceAdminPageHeader
        title="Analytics"
        subtitle="Traffic and engagement — view in Google Analytics."
      />
      <AdminGa4ExternalLink variant="full" />
    </>
  );
}
