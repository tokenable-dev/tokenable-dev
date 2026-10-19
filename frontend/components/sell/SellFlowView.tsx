"use client";

import { useSellFlow } from "@/hooks/sell/useSellFlow";
import { SellFlowAddCards } from "./SellFlowAddCards";
import { SellFlowChooseVault } from "./SellFlowChooseVault";
import { SellFlowPartnerAddCards } from "./SellFlowPartnerAddCards";

/** Choose a vault, then PSA add-cards or partner mint. */
export function SellFlowView() {
  const flow = useSellFlow();
  const choice = flow.vaultChoice === "self" ? "self" : "psa";
  const partnerHold =
    choice !== "self"
      ? null
      : flow.selfVaultNeedsCompanyAddress
        ? "address"
        : flow.selfVaultPartnerOnly
          ? "not-partner"
          : flow.selfVaultEligible
            ? null
            : "loading";

  return (
    <div className="sell-flow-page">
      {flow.screen === "cards" ? (
        flow.vaultChoice === "self" ? (
          <SellFlowPartnerAddCards flow={flow} />
        ) : (
          <SellFlowAddCards flow={flow} />
        )
      ) : (
        <SellFlowChooseVault
          choice={choice}
          onChoice={flow.selectVault}
          onContinue={flow.continueFromVault}
          partnerHold={partnerHold}
        />
      )}
    </div>
  );
}
