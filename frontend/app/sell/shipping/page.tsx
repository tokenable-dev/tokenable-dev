"use client";

import { Suspense } from "react";
import { SellShippingView } from "@/components/sell/SellShippingView";

/** PSA-Shipping.html — pack checklist + carrier tracking. */
export default function SellShippingPage() {
  return (
    <Suspense fallback={null}>
      <SellShippingView />
    </Suspense>
  );
}
