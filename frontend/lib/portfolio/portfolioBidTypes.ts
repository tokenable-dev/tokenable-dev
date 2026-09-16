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
  /** SSOT Line 1 — `{Name} · {Number} · {Grade}`. */
  displayLabel: string;
  /** SSOT Line 2 — `{Year} · {Set} {Language} · {Variant}`. */
  line2?: string;
  /** Hover / title attribute — Line 1 + Line 2 when available. */
  hoverLabel?: string;
  imageUrl: string | null;
};
