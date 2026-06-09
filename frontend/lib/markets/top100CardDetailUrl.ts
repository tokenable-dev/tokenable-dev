import type { Top100Item } from "@/hooks/markets/usePokemonTop100";

export function top100CardDetailHref(
  item: Pick<Top100Item, "card_id" | "grade" | "rank">,
  category: string,
): string {
  const params = new URLSearchParams({
    category,
    grade: item.grade ?? "PSA 10",
    rank: String(item.rank),
  });
  return `/markets/top100/card/${encodeURIComponent(item.card_id)}?${params.toString()}`;
}
