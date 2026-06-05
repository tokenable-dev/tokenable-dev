import type { OrderStatus } from "@/lib/core";

/** Collection bid row for portfolio (from offerer order history API). */
export type PortfolioBidRow = {
  orderHash: string;
  collectionKey: string;
  priceUsdc: number;
  priceLabel: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
};

export type PortfolioBidCollectionMeta = {
  displayLabel: string;
  imageUrl: string | null;
};
