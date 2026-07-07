"use client";

import dynamic from "next/dynamic";
import { TkActionSheet } from "@/components/ds";
import type { Order } from "@/lib/core";

const CollectionCriteriaBidPanel = dynamic(
  () =>
    import("@/components/marketplace/collection-criteria-bid").then((m) => ({
      default: m.CollectionCriteriaBidPanel,
    })),
  { ssr: false },
);

export function RwaDetailPlaceBidModal({
  open,
  assetTitle,
  collectionKey,
  collectionAsks,
  connectedAddress,
  hasActiveListing,
  onClose,
  onPlaced,
  onPurchaseFilled,
}: {
  open: boolean;
  assetTitle: string;
  collectionKey: string;
  collectionAsks: Order[];
  connectedAddress?: string;
  hasActiveListing: boolean;
  onClose: () => void;
  onPlaced?: () => void;
  onPurchaseFilled?: () => void;
}) {
  return (
    <TkActionSheet open={open} onClose={onClose} aria-label="Place bid">
      <header className="rd-bid-sheet__header">
        <h2 id="rwa-place-bid-title" className="rd-bid-sheet__title">
          Place bid
        </h2>
        <p className="rd-bid-sheet__subtitle line-clamp-2">{assetTitle}</p>
      </header>

      <CollectionCriteriaBidPanel
        variant="modal"
        collectionKey={collectionKey}
        activeAsks={collectionAsks}
        connectedAddress={connectedAddress}
        bidOnlySubmit={hasActiveListing}
        actionLayout="split"
        hideSellFooter
        onPlaced={() => onPlaced?.()}
        onPurchaseFilled={() => onPurchaseFilled?.()}
      />
    </TkActionSheet>
  );
}
