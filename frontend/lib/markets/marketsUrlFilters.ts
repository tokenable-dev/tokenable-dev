import {
  isCollectionCategoryId,
  type CollectionCategoryFilterId,
  type CollectionCategoryId,
} from "@/lib/market/collectionCategoryFilter";
import type { MarketsGradeFilterId } from "@/lib/markets/marketsFilters";
import {
  MARKETS_DEFAULT_SORT_ID,
  MARKETS_SORT_OPTIONS,
  type MarketsSortId,
} from "@/lib/markets/marketsCollectionSort";

/** Prototype `cat` path ↔ flat Markets category id (Card.html / markets-nav.js). */
const CAT_PATH_BY_FILTER: Record<CollectionCategoryId, string> = {
  pokemon: "tcg/pokemon",
  onepiece: "tcg/onepiece",
  basketball: "sports/basketball",
  baseball: "sports/baseball",
  football: "sports/football",
  soccer: "sports/soccer",
};

const FILTER_BY_CAT_PATH: Record<string, CollectionCategoryId> = {
  "tcg/pokemon": "pokemon",
  "tcg/onepiece": "onepiece",
  "sports/basketball": "basketball",
  "sports/baseball": "baseball",
  "sports/football": "football",
  "sports/soccer": "soccer",
  pokemon: "pokemon",
  onepiece: "onepiece",
  basketball: "basketball",
  baseball: "baseball",
  football: "football",
  soccer: "soccer",
};

export type MarketsUrlFilters = {
  /** Empty = all categories. Multiple = OR. */
  categories: CollectionCategoryId[];
  sortId: MarketsSortId;
  priceMin: string;
  priceMax: string;
  grades: MarketsGradeFilterId[];
  /** Card.html `character` — card / character name facet */
  characters: string[];
  /** Card.html `set` */
  sets: string[];
  yearMin: string;
  yearMax: string;
};

export function emptyMarketsUrlFilters(): MarketsUrlFilters {
  return {
    categories: [],
    sortId: MARKETS_DEFAULT_SORT_ID,
    priceMin: "",
    priceMax: "",
    grades: [],
    characters: [],
    sets: [],
    yearMin: "",
    yearMax: "",
  };
}

function splitPipe(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinPipe(values: string[]): string | null {
  const cleaned = values.map((s) => s.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join("|") : null;
}

export function categoryFilterToCatPath(
  filter: CollectionCategoryFilterId,
): string | null {
  if (filter === "all") return null;
  return CAT_PATH_BY_FILTER[filter] ?? null;
}

export function categoryIdsToCatParam(
  categories: readonly CollectionCategoryId[],
): string | null {
  const paths = [
    ...new Set(
      categories
        .map((id) => CAT_PATH_BY_FILTER[id])
        .filter((p): p is string => Boolean(p)),
    ),
  ];
  return paths.length > 0 ? paths.join("|") : null;
}

export function catPathToCategoryFilter(
  cat: string | null | undefined,
): CollectionCategoryFilterId {
  const ids = catParamToCategoryIds(cat);
  if (ids.length === 0) return "all";
  if (ids.length === 1) return ids[0]!;
  // Multi → keep first for single-id callers; prefer parse → categories[].
  return ids[0]!;
}

export function catParamToCategoryIds(
  cat: string | null | undefined,
): CollectionCategoryId[] {
  const parts = splitPipe(cat ?? null);
  if (parts.length === 0) {
    const raw = String(cat ?? "")
      .trim()
      .toLowerCase()
      .replace(/^\/+|\/+$/g, "");
    if (!raw) return [];
    return resolveCatToken(raw);
  }
  const out: CollectionCategoryId[] = [];
  const seen = new Set<CollectionCategoryId>();
  for (const part of parts) {
    for (const id of resolveCatToken(part)) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

function resolveCatToken(rawIn: string): CollectionCategoryId[] {
  const raw = rawIn
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
  if (!raw) return [];
  if (FILTER_BY_CAT_PATH[raw]) return [FILTER_BY_CAT_PATH[raw]!];
  if (isCollectionCategoryId(raw)) return [raw];
  for (const [path, id] of Object.entries(FILTER_BY_CAT_PATH)) {
    if (path.includes("/") && raw.startsWith(path)) return [id];
  }
  return [];
}

/** Map Details Category badge (Pokemon / NBA / …) → Markets category filter. */
export function categoryBadgeToFilterId(
  badge: string | null | undefined,
): CollectionCategoryFilterId {
  const t = String(badge ?? "")
    .trim()
    .toLowerCase();
  if (!t) return "all";
  if (t.includes("pokemon") || t.includes("ポケ")) return "pokemon";
  if (t.includes("one piece") || t.includes("onepiece")) return "onepiece";
  if (t.includes("basketball") || t === "nba") return "basketball";
  if (t.includes("baseball") || t === "mlb") return "baseball";
  if (t.includes("football") || t === "nfl") return "football";
  if (t.includes("soccer") || t === "fifa") return "soccer";
  return "all";
}

export function parseMarketsUrlFilters(
  params: URLSearchParams | { get(name: string): string | null },
): MarketsUrlFilters {
  const categories = catParamToCategoryIds(
    params.get("cat") ?? params.get("category"),
  );
  const sortRaw = params.get("sort")?.trim();
  const sortId =
    sortRaw &&
    MARKETS_SORT_OPTIONS.some((o) => o.id === sortRaw)
      ? (sortRaw as MarketsSortId)
      : MARKETS_DEFAULT_SORT_ID;

  const grades = splitPipe(params.get("grade")).filter((g) =>
    /^(PSA|BGS)\b/i.test(g),
  ) as MarketsGradeFilterId[];

  return {
    categories,
    sortId,
    priceMin: params.get("price_min")?.trim() ?? "",
    priceMax: params.get("price_max")?.trim() ?? "",
    grades,
    characters: splitPipe(params.get("character")),
    sets: splitPipe(params.get("set")),
    yearMin: params.get("year_min")?.trim() ?? "",
    yearMax: params.get("year_max")?.trim() ?? "",
  };
}

export function serializeMarketsUrlFilters(
  filters: MarketsUrlFilters,
): URLSearchParams {
  const p = new URLSearchParams();
  const cat = categoryIdsToCatParam(filters.categories);
  if (cat) p.set("cat", cat);

  if (filters.sortId && filters.sortId !== MARKETS_DEFAULT_SORT_ID) {
    p.set("sort", filters.sortId);
  }
  if (filters.priceMin.trim()) p.set("price_min", filters.priceMin.trim());
  if (filters.priceMax.trim()) p.set("price_max", filters.priceMax.trim());

  const grade = joinPipe(filters.grades);
  if (grade) p.set("grade", grade);

  const character = joinPipe(filters.characters);
  if (character) p.set("character", character);

  const set = joinPipe(filters.sets);
  if (set) p.set("set", set);

  if (filters.yearMin.trim()) p.set("year_min", filters.yearMin.trim());
  if (filters.yearMax.trim()) p.set("year_max", filters.yearMax.trim());

  return p;
}

export function marketsHrefFromFilters(
  filters: Partial<MarketsUrlFilters> & {
    /** @deprecated Prefer `categories`. */
    category?: CollectionCategoryFilterId;
  },
): string {
  const base = emptyMarketsUrlFilters();
  const fromLegacy =
    filters.category && filters.category !== "all"
      ? [filters.category as CollectionCategoryId]
      : [];
  const merged: MarketsUrlFilters = {
    ...base,
    ...filters,
    categories: filters.categories ?? fromLegacy,
    grades: filters.grades ?? base.grades,
    characters: filters.characters ?? base.characters,
    sets: filters.sets ?? base.sets,
  };
  const qs = serializeMarketsUrlFilters(merged).toString();
  return qs ? `/markets?${qs}` : "/markets";
}

export type MarketsDetailLinkContext = {
  categoryBadge?: string | null;
  /** Active Markets categories (empty = all). */
  categories?: readonly CollectionCategoryId[];
  /** @deprecated Prefer `categories`. */
  categoryFilter?: CollectionCategoryFilterId;
  gradeScore?: string | null;
  grader?: string | null;
};

function categoriesFromDetailCtx(
  ctx: MarketsDetailLinkContext,
): CollectionCategoryId[] {
  if (ctx.categories && ctx.categories.length > 0) return [...ctx.categories];
  if (ctx.categoryFilter && ctx.categoryFilter !== "all") {
    return [ctx.categoryFilter];
  }
  const fromBadge = categoryBadgeToFilterId(ctx.categoryBadge);
  return fromBadge === "all" ? [] : [fromBadge];
}

/**
 * Card.html Details attr-links → `/markets?…`
 * Linkable: Card name, Category, Set, Year, Grade, Grader.
 * Not linked: Card number, Variant, Language (no Markets facet yet).
 */
export function marketsHrefForDetailRow(
  rowId: string,
  value: string,
  ctx: MarketsDetailLinkContext = {},
): string | null {
  const v = value.trim();
  if (!v) return null;

  const categories = categoriesFromDetailCtx(ctx);

  switch (rowId) {
    case "character":
      return marketsHrefFromFilters({
        categories,
        characters: [v],
      });
    case "category": {
      const id = categoryBadgeToFilterId(v);
      return marketsHrefFromFilters({
        categories: id === "all" ? [] : [id],
      });
    }
    case "set":
      return marketsHrefFromFilters({
        categories,
        sets: [v],
      });
    case "year": {
      const y = v.replace(/\D/g, "").slice(0, 4);
      if (!/^\d{4}$/.test(y)) return null;
      return marketsHrefFromFilters({
        categories,
        yearMin: y,
        yearMax: y,
      });
    }
    case "grade": {
      const score = v.replace(/^#/, "").trim();
      const grader = (ctx.grader ?? "PSA").trim() || "PSA";
      if (!score) return null;
      const grade = `${grader} ${score}` as MarketsGradeFilterId;
      return marketsHrefFromFilters({
        categories,
        grades: [grade],
      });
    }
    case "grader": {
      const score = ctx.gradeScore?.replace(/^#/, "").trim();
      if (score) {
        const grade = `${v} ${score}` as MarketsGradeFilterId;
        return marketsHrefFromFilters({
          categories,
          grades: [grade],
        });
      }
      if (/^psa$/i.test(v)) {
        return marketsHrefFromFilters({
          categories,
          grades: ["PSA 10", "PSA 9"],
        });
      }
      if (/^bgs$/i.test(v)) {
        return marketsHrefFromFilters({
          categories,
          grades: ["BGS Pristine", "BGS 10", "BGS 9.5"],
        });
      }
      return null;
    }
    default:
      return null;
  }
}

export function marketsUrlFiltersEqual(
  a: MarketsUrlFilters,
  b: MarketsUrlFilters,
): boolean {
  return serializeMarketsUrlFilters(a).toString() === serializeMarketsUrlFilters(b).toString();
}
