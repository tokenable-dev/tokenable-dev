"use client";

import { VaultAuthGate } from "@/components/vault/VaultAuthGate";
import { useSellFlow } from "@/hooks/sell/useSellFlow";
import { SellFlowAddCards } from "./SellFlowAddCards";
import { SellFlowChooseVault } from "./SellFlowChooseVault";
import { SellFlowPartnerAddCards } from "./SellFlowPartnerAddCards";
import { SellFlowRegister } from "./SellFlowRegister";

/** Sell-Flow — register → choose vault → add cards (PSA ship or self mint). */
export function SellFlowView() {
  const flow = useSellFlow();

  return (
    <VaultAuthGate>
      <div className="sell-flow-page">
        {flow.screen === "register" ? (
          <SellFlowRegister flow={flow} />
        ) : flow.screen === "vault" ? (
          <SellFlowChooseVault flow={flow} />
        ) : flow.vaultChoice === "self" ? (
          <SellFlowPartnerAddCards flow={flow} />
        ) : (
          <SellFlowAddCards flow={flow} />
        )}
      </div>
    </VaultAuthGate>
  );
}
