import type { ReactNode } from "react";
import { MarketplaceAdminGate } from "@/components/marketplace/admin/MarketplaceAdminGate";

export default function MarketplaceAdminLayout({ children }: { children: ReactNode }) {
  return <MarketplaceAdminGate>{children}</MarketplaceAdminGate>;
}
