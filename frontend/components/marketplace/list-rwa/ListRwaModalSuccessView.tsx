"use client";

import { feePercent } from "@/lib/seaport/orders/platformFee";
import { TkButton } from "@/components/ds";
import type { ListSuccessMeta } from "@/lib/seaport/listing/listRwaModalTypes";

export function ListRwaModalSuccessView({
  tokenId,
  price,
  isReplaceListing,
  successMeta,
  onClose,
}: {
  tokenId: number;
  price: string;
  isReplaceListing: boolean;
  successMeta: ListSuccessMeta | null;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col px-0 pb-1 pt-1 text-center sm:pt-2">
      <p className="rd-list-sheet__eyebrow">
        {successMeta?.matched ? "Sold" : isReplaceListing ? "Updated" : "Listed"}
      </p>
      <div className="mb-2 mt-2 text-3xl leading-none">
        {successMeta?.matched ? "✓" : "🎉"}
      </div>
      <h3 id="list-rwa-success-title" className="text-base font-semibold tracking-tight text-white mb-1">
        {successMeta?.matched
          ? "Matched a collection bid"
          : isReplaceListing
            ? "Listing updated"
            : "Listed successfully"}
      </h3>
      <p className="text-[13px] leading-relaxed text-zinc-400">
        {successMeta?.matched
          ? `Asset #${tokenId} sold via matchAdvancedOrders (check your wallet for USDC).`
          : isReplaceListing
            ? `Asset #${tokenId} ask is now ${price} USDC.`
            : `Asset #${tokenId} is now listed for ${price} USDC`}
      </p>
      {!successMeta?.matched && feePercent() > 0 && (
        <p className="text-xs text-zinc-500 mt-2">
          {feePercent()}% platform fee included · You&apos;ll receive{" "}
          {(parseFloat(price) * (1 - feePercent() / 100)).toFixed(2)} USDC on sale
        </p>
      )}
      {!successMeta?.matched && (
        <p className="text-[11px] text-zinc-600 mt-2">Listing valid for 30 days</p>
      )}
      {!successMeta?.matched && successMeta?.hint ? (
        <div className="text-[11px] text-amber-200/90 mt-3 text-left leading-relaxed rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2.5 space-y-1.5">
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
          {successMeta.reasonCode === "timeout" ? (
            <p>Reason: Matching timed out.</p>
          ) : null}
          {successMeta.instantOnlyCancelled ? (
            <p>Protection: Listing was auto-cancelled to enforce instant-only execution.</p>
          ) : null}
          <p>{successMeta.hint}</p>
        </div>
      ) : null}
      <TkButton variant="neutral" onClick={onClose} className="mt-6 w-full justify-center">
        Close
      </TkButton>
    </div>
  );
}
