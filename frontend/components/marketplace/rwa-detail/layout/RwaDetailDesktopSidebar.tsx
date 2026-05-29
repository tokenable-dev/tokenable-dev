"use client";

import { useConnect } from "wagmi";
import { connectMetaMaskWallet } from "@/lib/wallet/connectMetaMaskWallet";
import { AssetDetailHeadlineTitle } from "@/components/marketplace/marketplace-shared";
import {
  RwaDetailHeaderBadges,
} from "@/components/marketplace/rwa-detail-asset-panel";
import type { RwaDetailMetadata } from "@/lib/marketplace/rwa-detail";
import {
  assetDetailHeadlineHasContent,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";
import type { Order } from "@/lib/core";
import { rwaDetailRightFont } from "../theme";
import { RwaDetailBuyerTradingPanel } from "../ui/RwaDetailBuyerTradingPanel";
import { RwaDetailGradientButton } from "../ui/RwaDetailGradientButton";
import { RwaDetailListPriceDisplay } from "../ui/RwaDetailListPriceDisplay";
import { RwaDetailMarketContextStrip } from "../ui/RwaDetailMarketContextStrip";

type StatRow = { label: string; value: string };

export function RwaDetailDesktopSidebar({
  detailHeadlineParts,
  detailTitle,
  detailTitlePulse,
  metadata,
  listingError,
  activeAskListing,
  isOwner,
  isConnected,
  listing,
  listingBuyPriceUsdc,
  buyBusy,
  buyErr,
  connectPending,
  externalRefUsd,
  marketChangePct,
  marketChangePeriodLabel,
  marketChangeCoverageHint,
  rwaDetailStatRows,
  onFulfillAsk,
  onOpenListModal,
}: {
  detailHeadlineParts: AssetDetailHeadlineParts;
  detailTitle: string;
  detailTitlePulse: boolean;
  metadata: RwaDetailMetadata | null;
  listingError: boolean;
  activeAskListing: Order | null;
  isOwner: boolean;
  isConnected: boolean;
  listing: Order | null | undefined;
  listingBuyPriceUsdc: number | null;
  buyBusy: boolean;
  buyErr: string | null;
  connectPending: boolean;
  externalRefUsd: number | null;
  marketChangePct: number | null;
  marketChangePeriodLabel: string;
  marketChangeCoverageHint: string;
  rwaDetailStatRows: StatRow[];
  onFulfillAsk: () => void;
  onOpenListModal: () => void;
}) {
  const { connect, connectors } = useConnect();

  return (
    <div className="hidden w-full min-w-0 flex-col gap-5 lg:sticky lg:top-6 lg:col-start-2 lg:flex lg:max-w-[400px] lg:justify-self-end lg:self-start">
      <div className="hidden min-w-0 space-y-2.5 lg:block">
        {detailTitlePulse ? (
          <div
            className="h-9 w-[min(100%,20rem)] max-w-full animate-pulse rounded-lg bg-gray-800/85"
            aria-hidden
          />
        ) : assetDetailHeadlineHasContent(detailHeadlineParts) ? (
          <AssetDetailHeadlineTitle
            as="h1"
            parts={detailHeadlineParts}
            className={`${rwaDetailRightFont.className} min-w-0 break-words text-[clamp(1.375rem,2.8vw,1.75rem)] font-bold leading-snug tracking-tight text-white [overflow-wrap:anywhere]`}
          />
        ) : (
          <h1
            className={`${rwaDetailRightFont.className} min-w-0 break-words text-[clamp(1.375rem,2.8vw,1.75rem)] font-bold leading-snug tracking-tight text-white`}
          >
            {detailTitle}
          </h1>
        )}
        <RwaDetailHeaderBadges metadata={metadata} loading={detailTitlePulse} />
      </div>

      {listingError ? (
        <p className="hidden text-xs text-orange-400 lg:block">Could not load listing.</p>
      ) : null}

      {activeAskListing && !isOwner ? (
        <div className="hidden lg:block">
          <RwaDetailBuyerTradingPanel
            isConnected={isConnected}
            buyBusy={buyBusy}
            listingPriceUsd={listingBuyPriceUsdc}
            buyErr={buyErr}
            onFulfill={onFulfillAsk}
          />
        </div>
      ) : null}

      {isOwner ? (
        <div className="hidden w-full max-w-full space-y-5 sm:space-y-6 lg:block">
          {listing && listingBuyPriceUsdc != null ? (
            <RwaDetailListPriceDisplay priceUsd={listingBuyPriceUsdc} />
          ) : null}
          <RwaDetailGradientButton
            bright={!isConnected}
            disabled={connectPending}
            onClick={() => {
              if (!isConnected) {
                connectMetaMaskWallet(connect, connectors);
                return;
              }
              onOpenListModal();
            }}
          >
            {!isConnected
              ? connectPending
                ? "Connecting…"
                : "Connect wallet"
              : listing
                ? "Manage listing"
                : "List for sale"}
          </RwaDetailGradientButton>
          {!listing ? (
            <RwaDetailMarketContextStrip
              externalRefUsd={externalRefUsd}
              marketChangePct={marketChangePct}
              changePeriodLabel={marketChangePeriodLabel}
              changeCoverageHint={marketChangeCoverageHint}
            />
          ) : null}
        </div>
      ) : null}

      {!activeAskListing && !isOwner ? (
        <div className="hidden space-y-5 sm:space-y-6 lg:block">
          <p className={`${rwaDetailRightFont.className} text-xl font-semibold text-zinc-400`}>
            Not for sale
          </p>
          <RwaDetailMarketContextStrip
            externalRefUsd={externalRefUsd}
            marketChangePct={marketChangePct}
            changePeriodLabel={marketChangePeriodLabel}
            changeCoverageHint={marketChangeCoverageHint}
          />
        </div>
      ) : null}

      {rwaDetailStatRows.length > 0 ? (
        <div
          className={`hidden border-t border-[rgba(38,39,45,1)] pt-6 lg:block ${rwaDetailRightFont.className}`}
        >
          <h2 className="text-[18px] font-bold leading-[140%] tracking-normal text-white">
            Details
          </h2>
          <dl className="mt-5 flex flex-col gap-4">
            {rwaDetailStatRows.map((row) => (
              <div
                key={row.label}
                className="flex min-w-0 items-baseline justify-between gap-4"
              >
                <dt className="shrink-0 text-[15px] font-normal leading-[140%] text-[#a0a0a0]">
                  {row.label}
                </dt>
                <dd className="min-w-0 break-words text-right text-[15px] font-medium leading-[140%] text-white">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
