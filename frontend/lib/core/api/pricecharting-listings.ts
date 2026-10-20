import { backendFetch, getApiUrl } from "./client";

export type CatalogProductHit = {
  id: string;
  productName: string;
  consoleName: string;
  genre: string | null;
  releaseDate: string | null;
  upc: string | null;
  loosePriceCents: number | null;
};

export type CatalogMatch = {
  match: CatalogProductHit | null;
  ambiguous: boolean;
};

export type CatalogListingPhoto = {
  id: string;
  publicUrl: string;
  sortOrder: number;
};

export type CatalogListing = {
  id: string;
  sellerUserId: string;
  pricechartingProductId: string;
  productName: string | null;
  consoleName: string | null;
  releaseDate: string | null;
  loosePriceCents: number | null;
  askPriceCents: number | null;
  quantity: number | null;
  sealedStatus: string | null;
  conditionNote: string | null;
  status: string;
  photos: CatalogListingPhoto[];
};

export type CatalogPriceRow = {
  column: string;
  label: string;
  cents: number;
};

export type CatalogListingDetail = CatalogListing & {
  genre: string | null;
  upc: string | null;
  salesVolume: number | null;
  tcgId: string | null;
  asin: string | null;
  epid: string | null;
  prices: CatalogPriceRow[];
  loosePriceHistory: { observedOn: string; loosePriceCents: number }[];
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

export function formatLoosePrice(cents: number | null): string {
  if (cents == null) return "Reference price unavailable";
  return `$${(cents / 100).toFixed(2)} loose price`;
}

export function formatAskPrice(cents: number | null): string {
  if (cents == null) return "Asking price not set";
  return `$${(cents / 100).toFixed(2)} asking price`;
}

export async function matchCatalogProduct(params: {
  id?: string;
  upc?: string;
  q?: string;
}): Promise<CatalogMatch> {
  const query = new URLSearchParams();
  if (params.id) query.set("id", params.id);
  if (params.upc) query.set("upc", params.upc);
  if (params.q) query.set("q", params.q);
  const res = await backendFetch(
    `${getApiUrl()}/pricecharting/catalog/product?${query.toString()}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<CatalogMatch>;
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

export async function createCatalogListing(input: {
  pricechartingProductId: string;
  clientRequestId: string;
}): Promise<CatalogListing> {
  const res = await backendFetch(`${getApiUrl()}/pricecharting/listings`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<CatalogListing>;
}

export async function uploadCatalogListingPhoto(
  listingId: string,
  file: File,
): Promise<CatalogListing> {
  const body = new FormData();
  body.append("file", file);
  const res = await backendFetch(`${getApiUrl()}/pricecharting/listings/${listingId}/photos`, {
    method: "POST",
    credentials: "include",
    body,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<CatalogListing>;
}

export async function submitCatalogListing(
  listingId: string,
  input: {
    askPriceCents: number;
    quantity: number;
    sealedStatus: string;
    conditionNote?: string;
  },
): Promise<CatalogListing> {
  const res = await backendFetch(`${getApiUrl()}/pricecharting/listings/${listingId}/submit`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<CatalogListing>;
}

export async function cancelCatalogListing(listingId: string): Promise<CatalogListing> {
  const res = await backendFetch(`${getApiUrl()}/pricecharting/listings/${listingId}/cancel`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<CatalogListing>;
}

export async function myCatalogListings(): Promise<CatalogListing[]> {
  const res = await backendFetch(`${getApiUrl()}/pricecharting/listings/mine`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<CatalogListing[]>;
}

export async function submittedCatalogListings(): Promise<CatalogListing[]> {
  const res = await backendFetch(`${getApiUrl()}/pricecharting/listings`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<CatalogListing[]>;
}

export async function submittedCatalogListing(id: string): Promise<CatalogListingDetail> {
  const res = await backendFetch(`${getApiUrl()}/pricecharting/listings/${id}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<CatalogListingDetail>;
}
