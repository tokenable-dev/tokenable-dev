import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
  RwaMetadata,
} from "@/lib/core";

export type CollectionCategoryFilterId =
  | "all"
  | "pokemon"
  | "mlb"
  | "nba"
  | "nfl"
  | "soccer"
  | "others";

/** Rough bucket from listing metadata text (best-effort). */
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

function pushHayPart(parts: string[], v: unknown) {
  if (typeof v === "string" && v.trim().length > 0) parts.push(v.trim());
}

/** Best-effort text for sport bucket rules (mint IPFS / portfolio metadata). */
export function buildHaystackFromRwaMetadata(meta: RwaMetadata | null): string {
  if (!meta) return "";
  const parts: string[] = [];
  pushHayPart(parts, meta.name);
  pushHayPart(parts, meta.description);
  for (const a of meta.attributes ?? []) {
    pushHayPart(parts, a.trait_type);
    if (a.value != null) pushHayPart(parts, String(a.value));
  }
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? (meta as { graded?: unknown }).graded) as
    | Record<string, unknown>
    | undefined;
  if (graded && typeof graded === "object") {
    const card = graded.card as Record<string, unknown> | undefined;
    pushHayPart(parts, card?.name);
    pushHayPart(parts, card?.set);
    const psa = graded.psa as Record<string, unknown> | undefined;
    pushHayPart(parts, psa?.category);
    pushHayPart(parts, graded.gradingCompany);
  }
  return parts.join(" ").toLowerCase();
}

export function inferSportBucketFromHaystack(hay: string): CollectionSportBucket {
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

  if (
    /\bnba\b|basketball|panini nba|\bhoops\b|michael jordan|upper deck jordan|fleer (?:basketball|ultra)|skybox (?:basketball|premium)|topps chrome basketball/i.test(
      hay,
    )
  ) {
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

export function inferSportBucketFromRwaMetadata(
  meta: RwaMetadata | null,
): CollectionSportBucket {
  return inferSportBucketFromHaystack(buildHaystackFromRwaMetadata(meta));
}

export function inferCollectionSportBucket(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): CollectionSportBucket {
  return inferSportBucketFromHaystack(buildHaystack(collection, snapshot));
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
