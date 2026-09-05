import type { Top100Item } from "@/hooks/markets/usePokemonTop100";

export type Top100Routing = {
  /** Full list page for a category (query param). */
  listHref: (category: string) => string;
  cardDetailHref: (
    item: Pick<Top100Item, "card_id" | "grade" | "rank">,
    category: string,
  ) => string;
  /** Preview variant "View all" CTA — hidden in admin. */
  showViewAllCta: boolean;
  /** Tab change updates URL when variant is full. */
  syncCategoryToUrl: boolean;
};

function cardDetailPath(
  base: string,
  item: Pick<Top100Item, "card_id" | "grade" | "rank">,
  category: string,
): string {
  const params = new URLSearchParams({
    category,
    grade: item.grade ?? "PSA 10",
    rank: String(item.rank),
  });
  return `${base}/${encodeURIComponent(item.card_id)}?${params.toString()}`;
}

export const MARKETS_TOP100_ROUTING: Top100Routing = {
  listHref: (category) =>
    `/markets/top100?category=${encodeURIComponent(category)}`,
  cardDetailHref: (item, category) =>
    cardDetailPath("/markets/top100/card", item, category),
  showViewAllCta: true,
  syncCategoryToUrl: true,
};

export const ADMIN_TOP100_ROUTING: Top100Routing = {
  listHref: (category) =>
    `/marketplace/admin/top100?category=${encodeURIComponent(category)}`,
  cardDetailHref: (item, category) =>
    cardDetailPath("/marketplace/admin/top100/card", item, category),
  showViewAllCta: false,
  syncCategoryToUrl: true,
};

export const ADMIN_TOP_MOVERS_ROUTING: Top100Routing = {
  listHref: (category) =>
    `/marketplace/admin/top-movers?category=${encodeURIComponent(category)}`,
  cardDetailHref: (item, category) =>
    cardDetailPath("/marketplace/admin/top100/card", item, category),
  showViewAllCta: false,
  syncCategoryToUrl: true,
};

/** @deprecated Use MARKETS_TOP100_ROUTING.cardDetailHref */
export function top100CardDetailHref(
  item: Pick<Top100Item, "card_id" | "grade" | "rank">,
  category: string,
): string {
  return MARKETS_TOP100_ROUTING.cardDetailHref(item, category);
}
