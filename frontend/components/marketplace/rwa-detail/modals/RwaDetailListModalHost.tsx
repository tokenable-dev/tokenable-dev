"use client";

import dynamic from "next/dynamic";
import type { Order } from "@/lib/core";

const ListRwaModal = dynamic(
  () =>
    import("@/components/marketplace/list-rwa/ListRwaModal").then((m) => ({
      default: m.ListRwaModal,
    })),
  { ssr: false },
);

export function RwaDetailListModalHost({
  open,
  tokenId,
  assetTitle,
  collectionKey,
  collectionBids,
  existingAskOrder,
  existingAskOrderHash,
  initialPriceUsdc,
  marketValueUsd,
  listedPriceUsd,
  copyVariant,
  onRequestCancelListing,
  onMatchedSale,
  onClose,
  onListed,
}: {
  open: boolean;
  tokenId: number;
  assetTitle: string;
  collectionKey?: string;
  collectionBids: Order[];
  existingAskOrder?: Order;
  existingAskOrderHash?: string | null;
  initialPriceUsdc: string | null;
  marketValueUsd?: number | null;
  listedPriceUsd?: number | null;
  copyVariant?: "default" | "set-price";
  onRequestCancelListing?: () => void;
  onMatchedSale: () => void;
  onClose: () => void;
  onListed: () => void;
}) {
  if (!open) return null;

  return (
    <ListRwaModal
      shell="sheet"
      tokenId={tokenId}
      assetTitle={assetTitle}
      collectionKey={collectionKey}
      collectionBids={collectionBids}
      existingAskOrder={existingAskOrder}
      existingAskOrderHash={existingAskOrderHash}
      initialPriceUsdc={initialPriceUsdc}
      marketValueUsd={marketValueUsd}
      listedPriceUsd={listedPriceUsd}
      copyVariant={copyVariant}
      onRequestCancelListing={onRequestCancelListing}
      onMatchedSale={onMatchedSale}
      onClose={onClose}
      onListed={onListed}
    />
  );
}
