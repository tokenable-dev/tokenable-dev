import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
  RwaMetadata,
} from "@/lib/core";

export type CollectionCategoryFilterId =
  | "all"
  | "basketball"
  | "baseball"
  | "football"
  | "soccer"
  | "pokemon"
  | "onepiece";

export type CategoryFilterOption = {
  id: CollectionCategoryFilterId;
  label: string;
};

/** Markets Category pop — six top-level buckets. No Sports / TCG parents. */
export const MARKETS_CATEGORY_FILTERS: CategoryFilterOption[] = [
  { id: "all", label: "All" },
  { id: "basketball", label: "Basketball" },
  { id: "baseball", label: "Baseball" },
  { id: "football", label: "Football" },
  { id: "soccer", label: "Soccer" },
  { id: "pokemon", label: "Pokemon" },
  { id: "onepiece", label: "One Piece" },
];

export const DEFAULT_CATEGORY_FILTERS: CategoryFilterOption[] = MARKETS_CATEGORY_FILTERS;

export const MARKETS_DEFAULT_CATEGORY_FILTER: CollectionCategoryFilterId = "all";

export type CollectionSportBucket =
  | "basketball"
  | "baseball"
  | "football"
  | "soccer"
  | "pokemon"
  | "onepiece"
  | "other";

function buildHaystack(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): string {
  const comp = collection.components;
  const parts = [
    snapshot?.categoryLabel,
    collection.queryUsed,
    collection.displayLabel,
    comp?.cardSetDisplay,
    comp?.cardSet,
    comp?.cardNameDisplay,
    comp?.cardName,
    comp?.psaCategory,
    comp?.gradingCompanyDisplay,
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

  if (/\bone[\s-]?piece\b|onepiece|ワンピース|\bopcg\b|\bop-0\d\b/i.test(hay)) {
    return "onepiece";
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
    return "basketball";
  }

  if (/\bnfl\b|panini nfl|super bowl|american football/i.test(hay)) {
    return "football";
  }

  if (
    /\bmlb\b|baseball|topps baseball|bowman|leaf baseball|\btopps chrome\b.*\b(baseball|mlb)\b/i.test(hay)
  ) {
    return "baseball";
  }

  if (/\bfootball\b/i.test(hay) && !/\bsoccer\b/i.test(hay)) {
    if (/\bnfl\b|panini nfl|prizm|donruss|score\b/i.test(hay)) {
      return "football";
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
  return bucket === filter;
}
