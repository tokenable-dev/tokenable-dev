import type { CollectionMarketPreview, RwaMetadata } from "@/lib/core";

export interface OwnedAsset {
  tokenId: number;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
}

export interface PricedAssetRow {
  tokenId: number;
  name: string;
  imageUrl: string | null;
  category: string | null;
  amount: number;
  currentPrice: number | null;
  priceSource: "cardhedger" | "psa_estimate" | "none";
  liquidityLabel: string | null;
  listPriceUsd: number | null;
  activeListingOrderHash: string | null;
  setName: string | null;
  marketPreviewRaw: CollectionMarketPreview | null;
  /** Downsampled 1y external market USD for gallery sparkline. */
  sparkline1y: number[];
}

export type AssetRow = PricedAssetRow;

export interface TxRow {
  type: "BUY" | "SELL";
  status?: "settled" | "pending" | "failed" | "vaulted";
  asset: string;
  category: string | null;
  amount: number;
  price: number;
  date: string;
  /** Drawer date line — includes time when available (Portfolio.html hx-drawer). */
  dateTimeLabel?: string;
  /** Epoch ms for chronological sort (display `date` is locale text). */
  dateMs: number;
  orderHash: string;
  tokenId?: number;
  imageUrl?: string | null;
  gradeLabel?: string | null;
  certNumber?: string | null;
}

export type AssetListFilter = "all" | "listed" | "unlisted" | "hidden";
