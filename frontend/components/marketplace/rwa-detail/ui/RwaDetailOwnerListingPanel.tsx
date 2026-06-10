"use client";

import { useConnect } from "wagmi";
import { connectMetaMaskWallet } from "@/lib/wallet/connectMetaMaskWallet";
import { RwaDetailAskPriceDisplay } from "./RwaDetailAskPriceDisplay";
import { RwaDetailGradientButton } from "./RwaDetailGradientButton";
import { RwaDetailMarketContextStrip } from "./RwaDetailMarketContextStrip";
import {
  RWA_DETAIL_CTA_ROW_TOP_CLASS,
  RWA_DETAIL_CTA_ROW_TOP_COMPACT_CLASS,
  RWA_DETAIL_LISTING_PRICE_COMPACT_AMOUNT_CLASS,
  RWA_DETAIL_UNLISTED_CTA_FOOTER_LEAD_CLASS,
  RWA_DETAIL_UNLISTED_CTA_ROW_TOP_CLASS,
  rwaDetailRightFont,
} from "../theme";

export function RwaDetailOwnerListingPanel({
  isConnected,
  connectPending,
  listingPriceUsd,
  marketPriceUsd,
  marketChangePct,
  marketChangePeriodLabel,
  marketChangeCoverageHint,
  onOpenListModal,
  onConnectWallet,
  compactActions = false,
}: {
  isConnected: boolean;
  connectPending: boolean;
  listingPriceUsd: number | null;
  marketPriceUsd: number | null;
  marketChangePct: number | null;
  marketChangePeriodLabel: string;
  marketChangeCoverageHint: string;
  onOpenListModal: (initialPriceUsdc?: string | null) => void;
  onConnectWallet?: () => void;
  /** Mobile sticky footer — mirrors RwaDetailBuyerTradePanel compact layout. */
  compactActions?: boolean;
}) {
  const { connect, connectors } = useConnect();
  const hasListing = listingPriceUsd != null;

  const handleConnect = () => {
    if (onConnectWallet) {
      onConnectWallet();
      return;
    }
    connectMetaMaskWallet(connect, connectors);
  };

  const ctaLabel = !isConnected
    ? connectPending
      ? "Connecting…"
      : compactActions
        ? "Connect wallet"
        : "Connect wallet to list"
    : hasListing
      ? "Change price"
      : "List for sale";

  const ctaRowTopClass = hasListing
    ? compactActions
      ? RWA_DETAIL_CTA_ROW_TOP_COMPACT_CLASS
      : RWA_DETAIL_CTA_ROW_TOP_CLASS
    : compactActions
      ? ""
      : RWA_DETAIL_UNLISTED_CTA_ROW_TOP_CLASS;

  return (
    <div
      className={`${rwaDetailRightFont.className} flex min-w-0 flex-col gap-4 sm:gap-5 ${
        compactActions && !hasListing ? RWA_DETAIL_UNLISTED_CTA_FOOTER_LEAD_CLASS : ""
      }`}
    >
      {hasListing && listingPriceUsd != null ? (
        compactActions ? (
          <p className={`text-center ${RWA_DETAIL_LISTING_PRICE_COMPACT_AMOUNT_CLASS}`}>
            $
            {listingPriceUsd.toLocaleString("en-US", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
          </p>
        ) : (
          <RwaDetailAskPriceDisplay priceUsd={listingPriceUsd} />
        )
      ) : null}

      {!compactActions ? (
        <RwaDetailMarketContextStrip
          variant="flat"
          externalRefUsd={marketPriceUsd}
          marketChangePct={marketChangePct}
          changePeriodLabel={marketChangePeriodLabel}
          changeCoverageHint={marketChangeCoverageHint}
        />
      ) : null}

      <div className={ctaRowTopClass || undefined}>
        <RwaDetailGradientButton
          bright={!isConnected}
          compact={compactActions}
          disabled={connectPending}
          onClick={() => {
            if (!isConnected) {
              handleConnect();
              return;
            }
            onOpenListModal(hasListing ? String(listingPriceUsd) : null);
          }}
        >
          {ctaLabel}
        </RwaDetailGradientButton>
      </div>
    </div>
  );
}
