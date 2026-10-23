"use client";

import { Suspense } from "react";
import { RedeemFlowView } from "@/components/portfolio/redeem/RedeemFlowView";

export default function PortfolioRedeemPage() {
  return (
    <Suspense
      fallback={
        <div className="pf-redeem-page">
          <p className="sell-flow-sub">Loading…</p>
        </div>
      }
    >
      <RedeemFlowView />
    </Suspense>
  );
}
