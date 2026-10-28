"use client";

import { useTranslations } from "next-intl";
import { formatUsdcAmount } from "@/lib/market/displayMoney";
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
  const t = useTranslations("Complete");
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

  const money = (value: number) => formatUsdcAmount(value);
  const listedSub =
    !successMeta?.matched && !fillFailed && !instantOnlyFailed && !softMatchNote
      ? isReplaceListing
        ? priceUsdc != null
          ? t("listedAtShort", { price: money(priceUsdc) })
          : undefined
        : net != null
          ? t("youGet", { price: money(Number(net)) })
          : priceUsdc != null
            ? t("youGet", { price: money(priceUsdc) })
            : t("listedAsset", { tokenId, price })
      : undefined;

  const fillFailedSub = fillFailed ? t("priceUnchanged") : undefined;
  const instantOnlySub = instantOnlyFailed
    ? successMeta?.hint?.trim() || t("instantFallback")
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

  const titleOverride = instantOnlyFailed ? t("instantFailed") : undefined;

  return (
    <ActionCompleteModal
      open
      kind={kind}
      title={titleOverride}
      priceUsdc={priceUsdc}
      sub={sub}
      onClose={onClose}
    />
  );
}
