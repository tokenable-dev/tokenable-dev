import type { MarketplaceCollectionDetail } from "@/lib/core";

/**
 * Collection detail hero cover URL.
 *
 * Same source twice: `collection.coverImageUrl` is the DB column; `representativeImageUrl` in the
 * API response is set from that row for older clients. Prefer the row, then the top-level field.
 */
export function pickCollectionHeroImageUrl(
  detail: Pick<MarketplaceCollectionDetail, "collection" | "representativeImageUrl">,
): string | null {
  const fromRow = detail.collection?.coverImageUrl?.trim();
  if (fromRow) return fromRow;
  const rep = detail.representativeImageUrl?.trim();
  return rep || null;
}
