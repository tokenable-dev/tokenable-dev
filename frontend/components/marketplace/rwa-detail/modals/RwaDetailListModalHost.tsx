"use client";

import dynamic from "next/dynamic";
import type { Order } from "@/lib/core";
import type { ListModalAnchorRect } from "@/lib/seaport/listing/listRwaModalTypes";
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
  initialPriceUsdc,
  anchorRect,
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
  initialPriceUsdc: string | null;
  anchorRect?: ListModalAnchorRect | null;
  onMatchedSale: () => void;
  onClose: () => void;
  onListed: () => void;
}) {
  if (!open) return null;

  return (
    <ListRwaModal
      tokenId={tokenId}
      assetTitle={assetTitle}
      collectionKey={collectionKey}
      collectionBids={collectionBids}
      existingAskOrder={existingAskOrder}
      initialPriceUsdc={initialPriceUsdc}
      anchorRect={anchorRect}
      onMatchedSale={onMatchedSale}
      onClose={onClose}
      onListed={onListed}
    />
  );
}
