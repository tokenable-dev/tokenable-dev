import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/api";

export type CollectionCategoryFilterId =
  | "all"
  | "pokemon"
  | "mlb"
  | "nba"
  | "nfl"
  | "soccer"
  | "others";

/** Rough bucket from JustTCG label + listing metadata text (best-effort). */
export type CollectionSportBucket =
  | "pokemon"
  | "mlb"
  | "nba"
  | "nfl"
  | "soccer"
  | "other";

function buildHaystack(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): string {
  const comp = collection.components as Record<string, unknown>;
  const parts = [
    snapshot?.categoryLabel,
    collection.queryUsed,
    collection.displayLabel,
    comp?.cardSet,
    comp?.cardName,
    comp?.gradingCompany,
  ];
  return parts
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

export function inferCollectionSportBucket(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): CollectionSportBucket {
  const hay = buildHaystack(collection, snapshot);
  if (!hay.trim()) return "other";

  if (/\bpokemon\b|ポケ|pikachu|charizard/i.test(hay)) {
    return "pokemon";
  }

  if (
    /\bsoccer\b|\bfifa\b|premier league|\buefa\b|\bmls\b|\blaliga\b|\bbundesliga\b|world cup|serie a\b/i.test(
      hay,
    )
  ) {
    return "soccer";
  }

  if (/\bnba\b|basketball|panini nba|\bhoops\b/i.test(hay)) {
    return "nba";
  }

  if (/\bnfl\b|panini nfl|super bowl/i.test(hay)) {
    return "nfl";
  }

  if (
    /\bmlb\b|baseball|topps baseball|bowman|leaf baseball|\btopps chrome\b.*\b(baseball|mlb)\b/i.test(hay)
  ) {
    return "mlb";
  }

  if (/\bfootball\b/i.test(hay) && !/\bsoccer\b/i.test(hay)) {
    if (/\bnfl\b|panini nfl|prizm|donruss|score\b/i.test(hay)) {
      return "nfl";
    }
  }

  return "other";
}

export function collectionMatchesCategoryFilter(
  filter: CollectionCategoryFilterId,
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): boolean {
  if (filter === "all") return true;
  const bucket = inferCollectionSportBucket(collection, snapshot);
  if (filter === "others") return bucket === "other";
  return bucket === filter;
}
