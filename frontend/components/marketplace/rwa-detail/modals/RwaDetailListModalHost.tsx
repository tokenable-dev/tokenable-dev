"use client";

import dynamic from "next/dynamic";
import type { Order } from "@/lib/core";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";

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
  headlineParts,
  headlineGrade,
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
  headlineParts?: AssetDetailHeadlineParts | null;
  headlineGrade?: string | null;
  collectionKey?: string;
  collectionBids: Order[];
  existingAskOrder?: Order;
  existingAskOrderHash?: string | null;
  initialPriceUsdc: string | null;
  marketValueUsd?: number | null;
  listedPriceUsd?: number | null;
  copyVariant?: "default" | "set-price";
  onRequestCancelListing?: () => void;
  onMatchedSale?: () => void;
  onClose: () => void;
  onListed: () => void;
}) {
  if (!open) return null;

  return (
    <ListRwaModal
      shell="sheet"
      tokenId={tokenId}
      assetTitle={assetTitle}
      headlineParts={headlineParts}
      headlineGrade={headlineGrade}
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
