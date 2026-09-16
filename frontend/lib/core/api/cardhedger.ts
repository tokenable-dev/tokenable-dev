import { backendFetch, getApiUrl } from "./client";

export type CardhedgerSearchCard = {
  card_id?: string;
  description?: string;
  player?: string | null;
  set?: string | null;
  number?: string | null;
  variant?: string | null;
  image?: string | null;
  category?: string | null;
};

/** Catalog search — returns Bubble `crop_image` / `resize` covers when available. */
export async function searchCardhedgerCards(req: {
  search: string;
  page?: number;
  page_size?: number;
}): Promise<{ cards: CardhedgerSearchCard[] }> {
  const res = await backendFetch(`${getApiUrl()}/cardhedger/v1/cards/card-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      search: req.search,
      page: req.page ?? 1,
      page_size: req.page_size ?? 10,
    }),
  });
  if (!res.ok) {
    throw new Error(`Card search failed (${res.status})`);
  }
  const body = (await res.json()) as { cards?: CardhedgerSearchCard[] };
  return { cards: Array.isArray(body.cards) ? body.cards : [] };
}
