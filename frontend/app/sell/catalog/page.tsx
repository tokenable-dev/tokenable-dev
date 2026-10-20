"use client";

import { CatalogListingFlow } from "@/components/sell/CatalogListingFlow";
import { VaultAuthGate } from "@/components/vault/VaultAuthGate";
import "@/styles/tokenable-sell-flow.css";

export default function SellCatalogPage() {
  return (
    <div className="sell-flow-page sell-flow-page--catalog">
      <VaultAuthGate>
        <CatalogListingFlow />
      </VaultAuthGate>
    </div>
  );
}
