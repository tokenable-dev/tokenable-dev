"use client";

import type { Order } from "@/lib/core";
import { RwaDetailAskPriceDisplay } from "./RwaDetailAskPriceDisplay";
import { RwaDetailGradientButton } from "./RwaDetailGradientButton";
import { RwaDetailMarketContextStrip } from "./RwaDetailMarketContextStrip";
import { RwaDetailOutlineButton } from "./RwaDetailOutlineButton";
import { rwaDetailRightFont } from "../theme";

export function RwaDetailBuyerTradePanel({
  collectionKey,
  activeAskListing,
  listingPriceUsd,
  marketPriceUsd,
  buyBusy,
  buyErr,
  isConnected,
  connectPending,
  onConnectWallet,
  onFulfillAsk,
  onOpenPlaceBid,
  marketChangePct,
  marketChangePeriodLabel,
  marketChangeCoverageHint,
  showMarketContextWhenUnlisted = false,
  compactActions = false,
}: {
  collectionKey: string | null;
  activeAskListing: Order | null;
  listingPriceUsd: number | null;
  marketPriceUsd: number | null;
  buyBusy: boolean;
  buyErr: string | null;
  isConnected: boolean;
  connectPending: boolean;
  onConnectWallet: () => void;
  onFulfillAsk: () => void | Promise<void>;
  onOpenPlaceBid?: () => void;
  marketChangePct?: number | null;
  marketChangePeriodLabel?: string;
  marketChangeCoverageHint?: string;
  showMarketContextWhenUnlisted?: boolean;
  /** Side-by-side CTAs (mobile sticky footer). */
  compactActions?: boolean;
}) {
  const hasListing = activeAskListing != null && listingPriceUsd != null;
  const canBid = Boolean(collectionKey && onOpenPlaceBid);

  const buyNowCta = !isConnected
    ? connectPending
      ? "Connecting…"
      : "Connect wallet"
    : buyBusy
      ? "Buying…"
      : "Buy now";

  const placeBidCta = !isConnected
    ? connectPending
      ? "Connecting…"
      : "Connect wallet"
    : "Place bid";

  const handlePlaceBid = () => {
    if (!isConnected) {
      onConnectWallet();
      return;
    }
    onOpenPlaceBid?.();
  };

  return (
    <div className={`${rwaDetailRightFont.className} flex min-w-0 flex-col gap-4 sm:gap-5`}>
      {hasListing ? (
        <>
          {listingPriceUsd != null ? (
            compactActions ? (
              <p className="text-center text-[1.125rem] font-semibold leading-none tabular-nums text-white sm:text-[1.1875rem]">
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
              marketChangePct={marketChangePct ?? null}
              changePeriodLabel={marketChangePeriodLabel ?? ""}
              changeCoverageHint={marketChangeCoverageHint ?? ""}
            />
          ) : null}

          <div className={canBid && isConnected ? "flex min-w-0 gap-2" : undefined}>
            <div className={canBid && isConnected ? "min-w-0 flex-1" : undefined}>
              <RwaDetailGradientButton
                bright={!isConnected}
                compact={compactActions}
                onClick={() => {
                  if (!isConnected) {
                    onConnectWallet();
                    return;
                  }
                  void onFulfillAsk();
                }}
                disabled={connectPending || buyBusy}
              >
                {buyNowCta}
              </RwaDetailGradientButton>
            </div>
            {canBid && isConnected ? (
              <div className="min-w-0 flex-1">
                <RwaDetailOutlineButton
                  compact={compactActions}
                  onClick={handlePlaceBid}
                  disabled={connectPending}
                >
                  {placeBidCta}
                </RwaDetailOutlineButton>
              </div>
            ) : null}
          </div>

          {!compactActions && buyErr ? (
            <p className="text-xs leading-snug text-red-400">{buyErr}</p>
          ) : null}
        </>
      ) : (
        <>
          {showMarketContextWhenUnlisted ? (
            <div className="space-y-3">
              <p className="text-xl font-semibold text-zinc-400">Not for sale</p>
              <RwaDetailMarketContextStrip
                externalRefUsd={marketPriceUsd}
                marketChangePct={marketChangePct ?? null}
                changePeriodLabel={marketChangePeriodLabel ?? ""}
                changeCoverageHint={marketChangeCoverageHint ?? ""}
              />
            </div>
          ) : null}

          {canBid ? (
            <RwaDetailGradientButton
              bright={!isConnected}
              compact={compactActions}
              onClick={handlePlaceBid}
              disabled={connectPending}
            >
              {placeBidCta}
            </RwaDetailGradientButton>
          ) : null}
        </>
      )}
    </div>
  );
}
