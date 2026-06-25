import type { ReactNode } from "react";
import { MarketplaceAdminGate } from "@/components/marketplace/admin/MarketplaceAdminGate";

export default function MarketplaceAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <MarketplaceAdminGate>{children}</MarketplaceAdminGate>
    </div>
  );
}
