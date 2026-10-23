"use client";

import { Suspense } from "react";
import MarketsPage from "@/components/markets/MarketsPage";

/** useSearchParams (Details → Markets deep links) needs a Suspense boundary. */
export default function MarketsRoutePage() {
  return (
    <Suspense fallback={null}>
      <MarketsPage />
    </Suspense>
  );
}
