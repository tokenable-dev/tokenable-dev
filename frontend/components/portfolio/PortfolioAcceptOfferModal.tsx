"use client";

import { formatUnits } from "viem";
import { TkButton } from "@/components/ds";
import { TkDialog } from "@/components/ds/Dialog";
import { askGrossUsdcMicros, bidUsdcAmount } from "@/lib/seaport/orders/bidUsdc";
import type { Order } from "@/lib/core";
import type { BuyerUsdcReadyResult } from "@/lib/seaport/fulfillment/runCriteriaMatch";

function usdcLabel(micros: bigint): string {
  try {
    return formatUnits(micros, 6);
  } catch {
    return "—";
  }
}

function shortWallet(addr: string): string {
  const s = addr.trim();
  if (s.length < 12) return s || "—";
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function PortfolioAcceptOfferModal({
  open,
  assetTitle,
  bid,
  listing,
  pending,
  preflightPending,
  buyerReady,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  assetTitle: string;
  bid: Order | null;
  listing: Order | null;
  pending?: boolean;
  preflightPending?: boolean;
  buyerReady?: BuyerUsdcReadyResult | null;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const offerUsdc = bid ? usdcLabel(bidUsdcAmount(bid)) : "—";
  const askUsdc = listing ? usdcLabel(askGrossUsdcMicros(listing)) : null;
  const buyer = bid?.offerer ? shortWallet(bid.offerer) : "—";
  const title = assetTitle.trim() || (bid ? `Token #${bid.tokenId}` : "Accept offer");
  const buyerBlocked = buyerReady != null && !buyerReady.ok;
  const confirmDisabled =
    pending || preflightPending || !bid || buyerBlocked;

  return (
    <TkDialog
      open={open}
      onClose={pending ? () => undefined : onClose}
      title="Accept offer?"
      description={`Sells now to the top bid. ${title} · Offer ${offerUsdc} USDC · Buyer ${buyer}`}
      footer={
        <div className="flex gap-2">
          <TkButton
            variant="neutral"
            size="sm"
            className="flex-1"
            disabled={pending}
            onClick={onClose}
          >
            {buyerBlocked ? "Close" : "Cancel"}
          </TkButton>
          <TkButton
            variant="primary"
            size="sm"
            className="flex-1"
            disabled={confirmDisabled}
            onClick={() => void onConfirm()}
          >
            {pending
              ? "Confirming…"
              : preflightPending
                ? "Checking buyer…"
                : buyerBlocked
                  ? "Offer unavailable"
                  : "Sell"}
          </TkButton>
        </div>
      }
    >
      <div className="space-y-2 text-left text-sm text-[var(--t2)]">
        {askUsdc ? (
          <p className="text-xs text-zinc-500">
            Your public ask stays at{" "}
            <span className="tkl-mono text-zinc-400">{askUsdc} USDC</span> until
            this trade succeeds. If the buyer cannot pay, your listing is unchanged.
          </p>
        ) : (
          <p className="text-xs text-zinc-500">
            If the buyer cannot pay, the transaction fails and nothing else changes.
          </p>
        )}
        {buyerBlocked ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100">
            This offer cannot be filled right now (buyer USDC or Seaport allowance).
            It has been removed from the active book so others do not retry it. Your
            ask was not changed.
          </p>
        ) : null}
        {error && !buyerBlocked ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
            {error}
          </p>
        ) : null}
      </div>
    </TkDialog>
  );
}
