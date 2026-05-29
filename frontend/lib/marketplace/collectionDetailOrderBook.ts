import type { Order, CollectionPlatformTapeFill } from "@/lib/core";
import type { CollectionUnifiedOrderBookProps } from "@/lib/marketplace/marketplaceTradingTypes";

export function buildCollectionDetailOrderBookProps(input: {
  collectionKey: string;
  asks: Order[];
  collectionBids: Order[];
  selectedLevelKey: string | null;
  onSelectLevel: CollectionUnifiedOrderBookProps["onSelectLevel"];
  lastTradePriceUsdc: number | null | undefined;
  tapeFills: CollectionPlatformTapeFill[];
  tapeLoading: boolean;
}): CollectionUnifiedOrderBookProps {
  return {
    collectionKey: input.collectionKey,
    asks: input.asks,
    collectionBids: input.collectionBids,
    onSelectLevel: input.onSelectLevel,
    selectedLevelKey: input.selectedLevelKey,
    compact: true,
    flush: true,
    lastTradePriceUsdc: input.lastTradePriceUsdc,
    lastTradeSide: "buy",
    tapeFills: input.tapeFills,
    tapeLoading: input.tapeLoading,
  };
}
