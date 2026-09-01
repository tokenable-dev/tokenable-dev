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
  metadataItems: PortfolioAssetsPageMetadataItem[];
  collectionKeys: Record<number, string>;
  marketItems: PortfolioMarketBatchItem[];
  mintPreviews: Record<number, CollectionMarketPreview>;
  holdings: PortfolioHoldingBatchItem[];
};

export async function postPortfolioAssetsPage(body: {
  walletAddress: string;
  tokenIds: number[];
}): Promise<PortfolioAssetsPageResponse> {
  const tokenIds = [
    ...new Set((body.tokenIds ?? []).map((n) => Math.floor(Number(n)))),
  ].filter((n) => Number.isFinite(n) && n >= 0);
  if (tokenIds.length === 0) {
    return {
      metadataItems: [],
      collectionKeys: {},
      marketItems: [],
      mintPreviews: {},
      holdings: [],
    };
  }
  if (tokenIds.length > PORTFOLIO_ASSETS_PAGE_MAX) {
    throw new Error(
      `Portfolio assets page max is ${PORTFOLIO_ASSETS_PAGE_MAX} tokenIds`,
    );
  }

  const res = await backendFetch(
    `${getApiUrl()}/marketplace/portfolio/assets-page`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: body.walletAddress,
        tokenIds,
      }),
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
