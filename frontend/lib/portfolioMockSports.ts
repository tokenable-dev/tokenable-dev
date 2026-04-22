import type { CollectionSportBucket } from "@/lib/collectionCategoryFilter";

/** Stable placeholder spot for MLB/NFL/NBA portfolio rows until a live feed is wired. */
export function mockDemoSpotUsd(
  tokenId: number,
  bucket: Extract<CollectionSportBucket, "mlb" | "nba" | "nfl">,
): number {
  const salt = bucket === "mlb" ? 11 : bucket === "nba" ? 17 : 23;
  const seed = (tokenId * 7919 + salt) % 10_000;
  const base = bucket === "nba" ? 225 : bucket === "nfl" ? 195 : 175;
  const span = bucket === "nba" ? 520 : bucket === "nfl" ? 480 : 420;
  return Math.round(base + (span * seed) / 10_000);
}

export const MOCK_SPORTS_PRICE_CAPTION = "Estimated spot";
export const MOCK_SPORTS_LIQUIDITY_CAPTION = "Listing depth (estimate)";
