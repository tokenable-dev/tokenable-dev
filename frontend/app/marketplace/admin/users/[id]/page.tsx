"use client";

import { use } from "react";
import { MarketplaceAdminUserDetailPage } from "@/components/marketplace/admin/MarketplaceAdminUserDetailPage";

export default function MarketplaceAdminUserDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <MarketplaceAdminUserDetailPage userId={id} />;
}
