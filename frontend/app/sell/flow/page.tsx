"use client";

import { Suspense } from "react";
import { SellFlowView } from "@/components/sell/SellFlowView";

/** Sell-Flow.html — seller registration + add cards. */
export default function SellFlowPage() {
  return (
    <Suspense fallback={null}>
      <SellFlowView />
    </Suspense>
  );
}
