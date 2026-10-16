import type { PrivyFundingEnvironment } from "@/lib/privy/funding";
import type { PrivyFiatOnrampSourceAsset } from "@/lib/privy/funding";

export type FiatAggregatorFundParams = {
  source: {
    assets: PrivyFiatOnrampSourceAsset[];
    defaultAsset: PrivyFiatOnrampSourceAsset;
  };
  destination: {
    asset: string;
    chain: `eip155:${number}`;
    address: string;
  };
  environment: PrivyFundingEnvironment;
  defaultAmount: string;
};

type Pending = {
  params: FiatAggregatorFundParams;
  resolve: (result: { ok: boolean; errorMessage?: string | null }) => void;
};

let pending: Pending | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function subscribeFiatAggregatorPending(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function takeFiatAggregatorPending(): Pending | null {
  const job = pending;
  pending = null;
  return job;
}

/** Runs Privy `useFiatOnramp` in a lazily loaded host — keeps Stripe/Meld chunks off the initial graph. */
export function requestFiatAggregatorFunding(
  params: FiatAggregatorFundParams,
): Promise<{ ok: boolean; errorMessage?: string | null }> {
  return new Promise((resolve) => {
    pending = {
      params,
      resolve,
    };
    notify();
  });
}
