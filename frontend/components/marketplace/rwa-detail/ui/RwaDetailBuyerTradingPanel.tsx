"use client";

import { useConnect } from "wagmi";
import { connectMetaMaskWallet } from "@/lib/wallet/connectMetaMaskWallet";
import { RwaDetailAskPriceDisplay } from "./RwaDetailAskPriceDisplay";
import { RwaDetailGradientButton } from "./RwaDetailGradientButton";

export function RwaDetailBuyerTradingPanel({
  isConnected,
  buyBusy,
  listingPriceUsd,
  marketPriceUsd: _marketPriceUsd = null,
  buyErr,
  onFulfill,
  compact = false,
}: {
  isConnected: boolean;
  buyBusy: boolean;
  listingPriceUsd: number | null;
  marketPriceUsd?: number | null;
  buyErr: string | null;
  onFulfill: () => void | Promise<void>;
  compact?: boolean;
}) {
  const { connect, connectors, isPending: connectPending } = useConnect();

  const cta = !isConnected
    ? connectPending
      ? "Connecting…"
      : "Connect wallet"
    : buyBusy
      ? "Buying…"
      : "Buy";

  return (
    <div className={compact ? "flex min-w-0 flex-col gap-2.5" : "space-y-5 sm:space-y-6"}>
      {!compact && listingPriceUsd != null && Number.isFinite(listingPriceUsd) ? (
        <RwaDetailAskPriceDisplay priceUsd={listingPriceUsd} />
      ) : listingPriceUsd != null && Number.isFinite(listingPriceUsd) && compact ? (
        <p className="text-[clamp(1.65rem,7vw,2.1rem)] font-bold leading-none tracking-tight text-mint tabular-nums">
          $
          {listingPriceUsd.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}
        </p>
      ) : null}

      <RwaDetailGradientButton
        bright={!isConnected}
        compact={compact}
        onClick={() => {
          if (!isConnected) {
            connectMetaMaskWallet(connect, connectors);
            return;
          }
          void onFulfill();
        }}
        disabled={connectPending || buyBusy}
      >
        {cta}
      </RwaDetailGradientButton>

      {buyErr ? (
        <p className="text-xs leading-snug text-red-400">{buyErr}</p>
      ) : null}
    </div>
  );
}
