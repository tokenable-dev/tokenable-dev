"use client";

import { Suspense } from "react";
import MarketsPage from "@/components/markets/MarketsPage";

/** Search.html — same grid as Markets, filtered by `q`. */
export default function SearchRoutePage() {
  return (
    <Suspense fallback={null}>
      <MarketsPage />
    </Suspense>
  );
}
