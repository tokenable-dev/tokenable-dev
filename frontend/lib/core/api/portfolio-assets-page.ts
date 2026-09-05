import type {
  CollectionMarketPreview,
  CollectionMarketSeries,
  CollectionMarketStats,
  PortfolioHoldingBatchItem,
  RwaMetadata,
} from "@/lib/core";
import { backendFetch, getApiUrl } from "./client";
import type { PortfolioMarketBatchItem } from "./portfolio";

export const PORTFOLIO_ASSETS_PAGE_MAX = 50;

export type PortfolioAssetsPageMetadataItem = {
  tokenId: number;
  tokenURI: string | null;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
  imageBackUrl: string | null;
};

export type PortfolioAssetsPageResponse = {
  /** Full wallet holdings from DB owner index (newest first). */
  ownedTokenIds: number[];
  metadataItems: PortfolioAssetsPageMetadataItem[];
  collectionKeys: Record<number, string>;
  marketItems: PortfolioMarketBatchItem[];
  mintPreviews: Record<number, CollectionMarketPreview>;
  holdings: PortfolioHoldingBatchItem[];
};

export async function postPortfolioAssetsPage(body: {
  walletAddress: string;
  /** Omit or pass [] to let the server resolve owned tokens from DB and return page 1. */
  tokenIds?: number[];
}): Promise<PortfolioAssetsPageResponse> {
  const tokenIds = [
    ...new Set((body.tokenIds ?? []).map((n) => Math.floor(Number(n)))),
  ].filter((n) => Number.isFinite(n) && n >= 0);

  if (tokenIds.length > PORTFOLIO_ASSETS_PAGE_MAX) {
    throw new Error(
      `Portfolio assets page max is ${PORTFOLIO_ASSETS_PAGE_MAX} tokenIds`,
    );
  }

  const payload: { walletAddress: string; tokenIds?: number[] } = {
    walletAddress: body.walletAddress,
  };
  if (tokenIds.length > 0) {
    payload.tokenIds = tokenIds;
  }

  const res = await backendFetch(
    `${getApiUrl()}/marketplace/portfolio/assets-page`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        "Failed to load portfolio assets page",
    );
  }
  return res.json() as Promise<PortfolioAssetsPageResponse>;
}
