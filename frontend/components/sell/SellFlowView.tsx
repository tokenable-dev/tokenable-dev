"use client";

import { VaultAuthGate } from "@/components/vault/VaultAuthGate";
import { useSellFlow } from "@/hooks/sell/useSellFlow";
import { SellFlowAddCards } from "./SellFlowAddCards";
import { SellFlowRegister } from "./SellFlowRegister";

/** Sell-Flow.html — register then add cards (design system-2). */
export function SellFlowView() {
  const flow = useSellFlow();

  return (
    <VaultAuthGate>
      <div className="sell-flow-page">
        {flow.screen === "register" ? (
          <SellFlowRegister flow={flow} />
        ) : (
          <SellFlowAddCards flow={flow} />
        )}
      </div>
    </VaultAuthGate>
  );
}
