"use client";

import type { Order } from "@/lib/core";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import { ListRwaModal } from "@/components/marketplace/list-rwa/ListRwaModal";

/** Portfolio / certificate entry that mounts {@link ListRwaModal}. */
export function ListRwaModalHost({
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
  onMatchedSale?: () => void;
  onClose: () => void;
  onListed: (tokenId?: number, created?: Order) => void;
}) {
  return (
    <ListRwaModal
      open={open}
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
      onMatchedSale={onMatchedSale}
      onClose={onClose}
      onListed={onListed}
    />
  );
}
