"use client";

import {
  feePercent,
  type AskSettlementPolicy,
} from "@/lib/seaport/orders/platformFee";
import { ActionCompleteModal } from "@/components/marketplace/trade/ActionCompleteModal";
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
  const priceNum = parseFloat(price);
  const fee = feePercent(settlementPolicy);
  const net =
    Number.isFinite(priceNum) && priceNum > 0 && fee > 0
      ? String(Math.round(priceNum * (1 - fee / 100)))
      : Number.isFinite(priceNum) && priceNum > 0
        ? String(Math.round(priceNum))
        : null;
  const priceUsdc = Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null;

  const fillFailed = Boolean(
    successMeta && !successMeta.matched && successMeta.keptAskAfterBuyerFundingFail,
  );
  const instantOnlyFailed = Boolean(
    successMeta && !successMeta.matched && successMeta.instantOnlyCancelled,
  );
  const softMatchNote =
    successMeta &&
    !successMeta.matched &&
    !fillFailed &&
    !instantOnlyFailed &&
    successMeta.hint?.trim()
      ? successMeta.hint.trim()
      : null;

  let kind: ActionCompleteKind = "listed";
  if (fillFailed || instantOnlyFailed) kind = "fill-failed";
  else if (successMeta?.matched) kind = "sale";
  else if (isReplaceListing) kind = "price-updated";
  else kind = "listed";

  const saleSub = successMeta?.matched ? undefined : null;

  const listedSub =
    !successMeta?.matched && !fillFailed && !instantOnlyFailed && !softMatchNote
      ? isReplaceListing
        ? priceUsdc != null
          ? `Listed at $${priceUsdc.toLocaleString("en-US")}.`
          : undefined
        : priceUsdc != null
          ? `You get $${priceUsdc.toLocaleString("en-US")} when it sells.`
          : `Asset #${tokenId} is now listed for ${price} USDC.`
      : undefined;

  const fillFailedSub = fillFailed ? "Your price is unchanged." : undefined;
  const instantOnlySub = instantOnlyFailed
    ? successMeta?.hint?.trim() ??
      "The bid couldn't be filled. Nothing is listed now."
    : undefined;

  const sub =
    fillFailed
      ? fillFailedSub
      : instantOnlyFailed
        ? instantOnlySub
        : softMatchNote
          ? softMatchNote
          : successMeta?.matched
            ? saleSub
            : listedSub;

  const feeHint =
    !successMeta?.matched &&
    !fillFailed &&
    !instantOnlyFailed &&
    !softMatchNote &&
    net != null &&
    fee > 0 ? (
      <p className="text-xs text-zinc-500 leading-relaxed">
        {`You receive ~$${Number(net).toLocaleString("en-US")} after ${fee}% platform fee`}
      </p>
    ) : null;

  const titleOverride = instantOnlyFailed
    ? "Instant sale didn't complete"
    : undefined;

  return (
    <ActionCompleteModal
      open
      kind={kind}
      title={titleOverride}
      priceUsdc={priceUsdc}
      sub={sub}
      extra={feeHint}
      primaryLabel="Done"
      onClose={onClose}
    />
  );
}
