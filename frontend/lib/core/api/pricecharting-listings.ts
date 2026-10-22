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
