import type { CollectionPlatformTapeFill, Order } from "@/lib/core";

/** Order-book depth row selected for the trade ticket / buy flow. */
export type BookRowSelection =
  | {
      side: "ask";
      levelKey: string;
      price: number;
      orders: Order[];
    }
  | {
      side: "bid";
      levelKey: string;
      price: number;
      orders: Order[];
    };

export type CollectionUnifiedOrderBookProps = {
  collectionKey: string;
  asks: Order[];
  collectionBids: Order[];
  onSelectLevel?: (sel: BookRowSelection) => void;
  selectedLevelKey?: string | null;
  compact?: boolean;
  flush?: boolean;
  embedInMobileTab?: boolean;
  lastTradePriceUsdc?: number | null;
  lastTradeSide?: "buy" | "sell" | null;
  tapeFills?: CollectionPlatformTapeFill[];
  tapeLoading?: boolean;
};

/** Post-trade celebration modal (buy vs sell). */
export type TradeCelebrationKind = "purchase" | "sale";
