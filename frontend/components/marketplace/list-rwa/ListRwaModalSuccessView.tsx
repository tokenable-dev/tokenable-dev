"use client";

import {
  feePercent,
  type AskSettlementPolicy,
} from "@/lib/seaport/orders/platformFee";
import { ActionCompletePanel } from "@/components/marketplace/trade/ActionCompleteModal";
import type { ActionCompleteKind } from "@/components/marketplace/trade/ActionCompleteModal";
import type { ListSuccessMeta } from "@/lib/seaport/listing/listRwaModalTypes";

export function ListRwaModalSuccessView({
  tokenId,
  price,
  isReplaceListing,
  successMeta,
  copyVariant = "default",
  settlementPolicy = "standard",
  onClose,
}: {
  tokenId: number;
  price: string;
  isReplaceListing: boolean;
  successMeta: ListSuccessMeta | null;
  copyVariant?: "default" | "set-price";
  settlementPolicy?: AskSettlementPolicy;
  onClose: () => void;
}) {
  const isSetPrice = copyVariant === "set-price";
  const isSelfVaultHold = settlementPolicy === "self_vault_hold";
  const priceNum = parseFloat(price);
  const fee = feePercent(settlementPolicy);
  const net =
    Number.isFinite(priceNum) && priceNum > 0
      ? isSelfVaultHold
        ? (priceNum * 0.95).toFixed(2)
        : fee > 0
          ? (priceNum * (1 - fee / 100)).toFixed(2)
          : null
      : null;
  const priceUsdc = Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null;

  const fillFailed = Boolean(
    successMeta && !successMeta.matched && successMeta.keptAskAfterBuyerFundingFail,
  );

  let kind: ActionCompleteKind = "listed";
  if (fillFailed) kind = "fill-failed";
  else if (successMeta?.matched) kind = "sale";
  else if (isSetPrice || isReplaceListing) kind = "price-updated";

  const saleSub = successMeta?.matched
    ? isSelfVaultHold
      ? `Asset #${tokenId} sold. USDC is held by Tokenable until the buyer confirms — then you receive ~${net ?? "—"} USDC.`
      : undefined
    : null;

  const listedSub =
    !successMeta?.matched && !fillFailed
      ? isSetPrice || isReplaceListing
        ? priceUsdc != null
          ? `Listed at $${priceUsdc.toLocaleString("en-US")}. We'll let you know when a bid meets it.`
          : undefined
        : `Asset #${tokenId} is now listed for ${price} USDC.`
      : undefined;

  const fillFailedSub = fillFailed
    ? `The offer was removed. Your listing stays active at $${
        priceUsdc != null ? priceUsdc.toLocaleString("en-US") : price
      }.`
    : undefined;

  const sub =
    fillFailed
      ? fillFailedSub
      : successMeta?.matched
        ? saleSub
        : listedSub;

  const feeHint =
    !successMeta?.matched && !fillFailed && net != null ? (
      <p className="text-xs text-zinc-500 leading-relaxed">
        {isSelfVaultHold
          ? `Payout ~$${Number(net).toLocaleString("en-US")} after buyer confirm (5% fee)`
          : fee > 0
            ? `You receive ~$${Number(net).toLocaleString("en-US")} after ${fee}% platform fee`
            : null}
      </p>
    ) : null;

  const reviewHint =
    !successMeta?.matched && !fillFailed && successMeta?.collectionUnderReview ? (
      <div className="rounded-lg border border-sky-500/35 bg-sky-500/[0.1] px-3 py-2.5">
        <p className="text-[13px] font-semibold text-sky-100">Collection under review</p>
        <p className="mt-1 text-[12px] leading-relaxed text-sky-100/85">
          Your listing was submitted. This collection is new, so it will appear on Markets
          after an admin review. You can manage your listing anytime from your portfolio.
        </p>
      </div>
    ) : null;

  const matchHint =
    !successMeta?.matched &&
    !fillFailed &&
    successMeta?.hint ? (
      <div className="text-xs text-amber-200/90 leading-relaxed rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2.5 space-y-1.5">
        <p>
          A collection bid at or above your price was found, but it could not be filled
          automatically.
        </p>
        {successMeta.reasonCode === "insufficient_balance" ? (
          <p>Reason: Buyer balance insufficient.</p>
        ) : null}
        {successMeta.reasonCode === "insufficient_allowance" ? (
          <p>Reason: Buyer allowance insufficient.</p>
        ) : null}
        {successMeta.reasonCode === "merkle_mismatch" ? (
          <p>Reason: Merkle root mismatch.</p>
        ) : null}
        {successMeta.reasonCode === "expired_or_inactive" ? (
          <p>Reason: Bid or listing expired/inactive.</p>
        ) : null}
        {successMeta.reasonCode === "timeout" ? <p>Reason: Matching timed out.</p> : null}
        {successMeta.instantOnlyCancelled ? (
          <p>Protection: Listing was auto-cancelled to enforce instant-only execution.</p>
        ) : null}
        <p>{successMeta.hint}</p>
      </div>
    ) : null;

  return (
    <ActionCompletePanel
      kind={kind}
      priceUsdc={priceUsdc}
      sub={sub}
      embedded
      showStatus={false}
      extra={
        <>
          {feeHint}
          {reviewHint}
          {matchHint}
        </>
      }
      primaryLabel="Done"
      onPrimary={onClose}
    />
  );
}
