import type { Order } from "@/lib/core";
import type { CollectionCriteriaBidStep } from "@/lib/marketplace/collectionCriteriaBidTypes";

export type { CollectionCriteriaBidStep } from "@/lib/marketplace/collectionCriteriaBidTypes";

export type CollectionCriteriaBidActionLayout = "combined" | "split";

export type CollectionCriteriaBidPanelProps = {
  collectionKey: string;
  activeAsks?: Order[];
  connectedAddress?: `0x${string}` | string | null;
  onPlaced?: (order: Order) => void;
  onInstantBuyFillUsdc?: (usdc: number) => void;
  onOpenSellModal?: () => void;
  presetPriceFromBook?: string | null;
  variant?: "card" | "embedded" | "modal";
  onPurchaseFilled?: () => void;
  /** Card detail: Buy Now is separate — Place Bid always posts a collection bid. */
  bidOnlySubmit?: boolean;
  /** Card detail: show dedicated Place Bid button (Buy Now lives outside the panel). */
  actionLayout?: CollectionCriteriaBidActionLayout;
  hideSellFooter?: boolean;
  /** Hide submit CTA — caller triggers submit via ref (mobile sticky footer). */
  hideSubmitButton?: boolean;
};
