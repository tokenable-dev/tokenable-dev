import type { Order } from "@/lib/core";
import type { CollectionCriteriaBidStep } from "@/lib/marketplace/collectionCriteriaBidTypes";

export type { CollectionCriteriaBidStep } from "@/lib/marketplace/collectionCriteriaBidTypes";

export type CollectionCriteriaBidPanelProps = {
  collectionKey: string;
  activeAsks?: Order[];
  connectedAddress?: `0x${string}` | string | null;
  onPlaced?: (order: Order) => void;
  onInstantBuyFillUsdc?: (usdc: number) => void;
  onOpenSellModal?: () => void;
  presetPriceFromBook?: string | null;
  variant?: "card" | "embedded";
  onPurchaseFilled?: () => void;
};
