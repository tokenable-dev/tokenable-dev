import { backendFetch, getApiUrl } from "./client";

export type CatalogProductHit = {
  id: string;
  productName: string;
  consoleName: string;
  genre: string | null;
  releaseDate: string | null;
  upc: string | null;
  loosePriceCents: number | null;
  coverImageUrl?: string | null;
};

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.message) return body.message;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

export async function searchCatalogProducts(q: string): Promise<CatalogProductHit[]> {
  const res = await backendFetch(
    `${getApiUrl()}/pricecharting/catalog/products?q=${encodeURIComponent(q)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<CatalogProductHit[]>;
}

export async function searchCatalogUpc(upc: string): Promise<CatalogProductHit[]> {
  const res = await backendFetch(
    `${getApiUrl()}/pricecharting/catalog/upc?upc=${encodeURIComponent(upc)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<CatalogProductHit[]>;
}

/** Local catalog match — exactly one of id / upc / q. */
export async function matchCatalogProduct(input: {
  id?: string;
  upc?: string;
  q?: string;
}): Promise<{ match: CatalogProductHit | null; ambiguous: boolean }> {
  const params = new URLSearchParams();
  if (input.id?.trim()) params.set("id", input.id.trim());
  else if (input.upc?.trim()) params.set("upc", input.upc.trim());
  else if (input.q?.trim()) params.set("q", input.q.trim());
  const res = await backendFetch(
    `${getApiUrl()}/pricecharting/catalog/product?${params.toString()}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<{
    match: CatalogProductHit | null;
    ambiguous: boolean;
  }>;
}
