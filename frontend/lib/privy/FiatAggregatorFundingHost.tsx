"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  subscribeFiatAggregatorPending,
  takeFiatAggregatorPending,
  type FiatAggregatorFundParams,
} from "@/lib/privy/fiatAggregatorBridge";

const FiatAggregatorRunner = dynamic(
  () =>
    import("@/lib/privy/FiatAggregatorRunner").then((m) => ({
      default: m.FiatAggregatorRunner,
    })),
  { ssr: false },
);

/**
 * Mount once under PrivyProvider. Loads fiat-aggregator chunks only after the first Add funds (mainnet).
 */
export function FiatAggregatorFundingHost() {
  const [active, setActive] = useState<FiatAggregatorFundParams | null>(null);
  const [resolver, setResolver] = useState<
    ((result: { ok: boolean; errorMessage?: string | null }) => void) | null
  >(null);

  useEffect(() => {
    return subscribeFiatAggregatorPending(() => {
      const job = takeFiatAggregatorPending();
      if (!job) return;
      setActive(job.params);
      setResolver(() => job.resolve);
    });
  }, []);

  if (!active) return null;

  return (
    <FiatAggregatorRunner
      params={active}
      onDone={(ok, errMsg) => {
        resolver?.({ ok, errorMessage: errMsg });
        setResolver(null);
        setActive(null);
      }}
    />
  );
}
