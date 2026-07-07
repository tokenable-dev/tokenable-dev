"use client";

import { useEffect, useRef } from "react";
import { MintForm } from "@/components/vault";
import { useSellAccessGate } from "@/hooks/auth/useSellAccessGate";
import { VaultFeatures } from "./VaultFeatures";
import { VaultGateState } from "./VaultGateState";
import { VaultPortfolioBanner } from "./VaultPortfolioBanner";
import { VaultStepper } from "./VaultStepper";
import { VaultSubmitHeader } from "./VaultSubmitHeader";

export function VaultPageBody() {
  const { canSell, runSellAccessGate } = useSellAccessGate("/vault");
  const prompted = useRef(false);

  useEffect(() => {
    if (canSell || prompted.current) return;
    prompted.current = true;
    runSellAccessGate();
  }, [canSell, runSellAccessGate]);

  return (
    <>
      {canSell ? (
        <>
          <VaultStepper active={1} />
          <VaultSubmitHeader />
          <MintForm />
          <VaultPortfolioBanner />
        </>
      ) : (
        <VaultGateState onContinue={() => runSellAccessGate()} />
      )}
      <VaultFeatures />
    </>
  );
}
