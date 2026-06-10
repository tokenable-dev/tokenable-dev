"use client";

import { useConnect } from "wagmi";
import { connectMetaMaskWallet } from "@/lib/wallet/connectMetaMaskWallet";
import { RwaDetailAskPriceDisplay } from "./RwaDetailAskPriceDisplay";
import { RwaDetailGradientButton } from "./RwaDetailGradientButton";
import { RwaDetailMarketContextStrip } from "./RwaDetailMarketContextStrip";

export function RwaDetailOwnerListingPanel({
  isConnected,
  connectPending,
  listingPriceUsd,
  marketPriceUsd,
  marketChangePct,
  marketChangePeriodLabel,
  marketChangeCoverageHint,
  onOpenListModal,
}: {
  isConnected: boolean;
  connectPending: boolean;
  listingPriceUsd: number | null;
  marketPriceUsd: number | null;
  marketChangePct: number | null;
  marketChangePeriodLabel: string;
  marketChangeCoverageHint: string;
  onOpenListModal: (initialPriceUsdc?: string | null) => void;
}) {
  const { connect, connectors } = useConnect();

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <RwaDetailGradientButton
          disabled={connectPending}
          onClick={() => connectMetaMaskWallet(connect, connectors)}
        >
          {connectPending ? "Connecting…" : "Connect wallet to list"}
        </RwaDetailGradientButton>
      </div>
    );
  }

  const hasListing = listingPriceUsd != null;

  return (
    <div className="space-y-4">
      {hasListing ? (
        <RwaDetailAskPriceDisplay priceUsd={listingPriceUsd} />
      ) : null}

      <RwaDetailMarketContextStrip
        variant="flat"
        externalRefUsd={marketPriceUsd}
        marketChangePct={marketChangePct}
        changePeriodLabel={marketChangePeriodLabel}
        changeCoverageHint={marketChangeCoverageHint}
      />

      <RwaDetailGradientButton
        onClick={() => onOpenListModal(hasListing ? String(listingPriceUsd) : null)}
      >
        {hasListing ? "Change price" : "List for sale"}
      </RwaDetailGradientButton>
    </div>
  );
}
