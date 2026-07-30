"use client";

import { feePercent } from "@/lib/seaport/orders/platformFee";
import { TkButton } from "@/components/ds";
import type { ListSuccessMeta } from "@/lib/seaport/listing/listRwaModalTypes";

export function ListRwaModalSuccessView({
  tokenId,
  price,
  isReplaceListing,
  successMeta,
  copyVariant = "default",
  onClose,
}: {
  tokenId: number;
  price: string;
  isReplaceListing: boolean;
  successMeta: ListSuccessMeta | null;
  copyVariant?: "default" | "set-price";
  onClose: () => void;
}) {
  const isSetPrice = copyVariant === "set-price";
  const priceNum = parseFloat(price);
  const fee = feePercent();
  const net =
    Number.isFinite(priceNum) && fee > 0
      ? (priceNum * (1 - fee / 100)).toFixed(2)
      : null;

  const eyebrow = successMeta?.matched
    ? "Sold"
    : isSetPrice
      ? isReplaceListing
        ? "Updated"
        : "Listed"
      : isReplaceListing
        ? "Updated"
        : "Listed";

  const title = successMeta?.matched
    ? "Matched a collection bid"
    : isSetPrice
      ? isReplaceListing
        ? "Price updated"
        : "Price set"
      : isReplaceListing
        ? "Listing updated"
        : "Listed successfully";

  const sub = successMeta?.matched
    ? `Asset #${tokenId} sold via matchAdvancedOrders (check your wallet for USDC).`
    : isSetPrice
      ? isReplaceListing
        ? `Listed at $${Number.isFinite(priceNum) ? priceNum.toLocaleString("en-US") : price}. We'll let you know when a bid meets it.`
        : `Listed at $${Number.isFinite(priceNum) ? priceNum.toLocaleString("en-US") : price}. We'll let you know when a bid meets it.`
      : isReplaceListing
        ? `Asset #${tokenId} ask is now ${price} USDC.`
        : `Asset #${tokenId} is now listed for ${price} USDC`;

  return (
    <div className="flex flex-col px-0 pb-1 pt-1 text-center sm:pt-2">
      <p className="rd-list-sheet__eyebrow">{eyebrow}</p>
      <div className="mb-2 mt-2 text-3xl leading-none">
        {successMeta?.matched ? "✓" : isSetPrice ? "✓" : "🎉"}
      </div>
      <h3 id="list-rwa-success-title" className="text-base font-semibold tracking-tight text-white mb-1">
        {title}
      </h3>
      <p className="text-[13px] leading-relaxed text-zinc-400">{sub}</p>
      {!successMeta?.matched && !isSetPrice && fee > 0 && (
        <p className="text-xs text-zinc-500 mt-2">
          {fee}% platform fee included · You&apos;ll receive{" "}
          {net} USDC on sale
        </p>
      )}
      {!successMeta?.matched && isSetPrice && net != null ? (
        <p className="text-xs text-zinc-500 mt-2">
          You receive ~${Number(net).toLocaleString("en-US")} after {fee}% platform fee
        </p>
      ) : null}
      {!successMeta?.matched && !isSetPrice && (
        <p className="text-[11px] text-zinc-600 mt-2">Listing valid for 30 days</p>
      )}
      {!successMeta?.matched && successMeta?.collectionUnderReview ? (
        <div className="mt-3 rounded-lg border border-sky-500/35 bg-sky-500/[0.1] px-3 py-2.5 text-left">
          <p className="text-[13px] font-semibold text-sky-100">
            Collection under review
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-sky-100/85">
            Your listing was submitted. This collection is new, so it will appear
            on Markets after an admin review. You can manage your listing anytime
            from your portfolio.
          </p>
        </div>
      ) : null}
      {!successMeta?.matched && successMeta?.hint ? (
        <div className="text-[11px] text-amber-200/90 mt-3 text-left leading-relaxed rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2.5 space-y-1.5">
          {successMeta.keptAskAfterBuyerFundingFail ? (
            <>
              <p>
                That bid could no longer be filled. The offer was removed from the
                book.
              </p>
              <p>
                Your listing stays active at $
                {Number.isFinite(priceNum)
                  ? priceNum.toLocaleString("en-US")
                  : price}
                .
              </p>
            </>
          ) : (
            <p>
              A collection bid at or above your price was found, but it could not be filled
              automatically.
            </p>
          )}
          {!successMeta.keptAskAfterBuyerFundingFail &&
          successMeta.reasonCode === "insufficient_balance" ? (
            <p>Reason: Buyer balance insufficient.</p>
          ) : null}
          {!successMeta.keptAskAfterBuyerFundingFail &&
          successMeta.reasonCode === "insufficient_allowance" ? (
            <p>Reason: Buyer allowance insufficient.</p>
          ) : null}
          {successMeta.reasonCode === "merkle_mismatch" ? (
            <p>Reason: Merkle root mismatch.</p>
          ) : null}
          {successMeta.reasonCode === "expired_or_inactive" ? (
            <p>Reason: Bid or listing expired/inactive.</p>
          ) : null}
          {successMeta.reasonCode === "timeout" ? (
            <p>Reason: Matching timed out.</p>
          ) : null}
          {successMeta.instantOnlyCancelled ? (
            <p>Protection: Listing was auto-cancelled to enforce instant-only execution.</p>
          ) : null}
          {!successMeta.keptAskAfterBuyerFundingFail ? (
            <p>{successMeta.hint}</p>
          ) : null}
        </div>
      ) : null}
      <TkButton variant="primary" onClick={onClose} className="mt-6 w-full justify-center">
        Done
      </TkButton>
    </div>
  );
}
