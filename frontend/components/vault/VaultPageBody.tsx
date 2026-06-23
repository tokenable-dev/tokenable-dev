"use client";

import { useEffect, useRef } from "react";
import { MintForm } from "@/components/vault";
import { useSellAccessGate } from "@/hooks/auth/useSellAccessGate";

export function VaultPageBody() {
  const { canSell, runSellAccessGate } = useSellAccessGate("/vault");
  const prompted = useRef(false);

  useEffect(() => {
    if (canSell || prompted.current) return;
    prompted.current = true;
    runSellAccessGate();
  }, [canSell, runSellAccessGate]);

  if (!canSell) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-gray-400">Verification required to sell.</p>
        <button
          type="button"
          onClick={() => runSellAccessGate()}
          className="mt-4 text-sm font-semibold text-mint hover:text-mint/80"
        >
          Continue
        </button>
      </div>
    );
  }

  return <MintForm />;
}
