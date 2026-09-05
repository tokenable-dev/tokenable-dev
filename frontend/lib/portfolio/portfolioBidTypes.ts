import type { OrderStatus } from "@/lib/core";

/** Card-level offer row for portfolio (from offerer order history API). */
export type PortfolioBidRow = {
  orderHash: string;
  collectionKey: string;
  tokenId: string;
  priceUsdc: number;
  priceLabel: string;
  status: OrderStatus;
  createdAt: string;
  /** ISO timestamp for order expiry (Seaport endTime). */
  endTime?: string;
  updatedAt?: string;
};

export type PortfolioBidCollectionMeta = {
  displayLabel: string;
  imageUrl: string | null;
};
