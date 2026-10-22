import { backendFetch, getApiUrl } from "./client";

export type PricechartingGuide = {
  key: string;
  label: string;
  lastRowCount: number | null;
  lastRunAt: string | null;
};

export type PricechartingCatalogSummary = {
  totalProducts: number;
  byGenre: { genre: string; count: number }[];
  guides: PricechartingGuide[];
  recentRuns: {
    id: number;
    filename: string;
    rowCount: number;
    skippedCount: number;
    genres: Record<string, number>;
    status: string;
    errorMessage: string | null;
    createdAt: string;
  }[];
};

export type PricechartingImportResult = {
  runId: number;
  filename: string;
  rowCount: number;
  skipped: number;
  genres: Record<string, number>;
  totalProducts: number;
  historyCount: number;
  imported?: boolean;
  archived?: boolean;
  archiveError?: string | null;
};

export type PricechartingGuideSyncResult = {
  key: string;
  label: string;
  rowCount: number;
  historyCount: number;
  totalProducts: number;
  imported?: boolean;
  archived?: boolean;
  archiveError?: string | null;
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

export async function getPricechartingCatalog(): Promise<PricechartingCatalogSummary> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/pricecharting/catalog`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<PricechartingCatalogSummary>;
}

export async function uploadPricechartingCsv(
  file: File,
): Promise<PricechartingImportResult> {
  const body = new FormData();
  body.append("file", file);
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/pricecharting/import`,
    { method: "POST", credentials: "include", body, timeoutMs: 300_000 },
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<PricechartingImportResult>;
}

export type PricechartingProductHit = {
  id: string;
  productName: string;
  consoleName: string;
  genre: string | null;
  releaseDate: string | null;
  upc: string | null;
  loosePriceCents: number | null;
  coverImageUrl?: string | null;
};

export async function uploadPricechartingCover(
  productId: string,
  file: File,
): Promise<{ id: string; productName: string; coverImageUrl: string }> {
  const body = new FormData();
  body.append("image", file);
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/pricecharting/products/${encodeURIComponent(productId)}/cover`,
    { method: "POST", credentials: "include", body, timeoutMs: 120_000 },
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<{ id: string; productName: string; coverImageUrl: string }>;
}

export async function searchPricechartingProducts(
  q: string,
): Promise<PricechartingProductHit[]> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/pricecharting/products?q=${encodeURIComponent(q)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<PricechartingProductHit[]>;
}

export type ManualPriceHistoryResult = {
  productId: string;
  productName: string;
  consoleName: string;
  observedOn: string;
  savedCents: Record<string, number>;
  /** True when catalog + sealed-box collection spot were updated. */
  syncedCurrentLoose?: boolean;
};

export async function recordPricechartingHistory(input: {
  productId: string;
  observedOn: string;
  prices: Record<string, string>;
  /** Also write loose onto the catalog product and sealed-box collection spot. */
  syncCurrent?: boolean;
}): Promise<ManualPriceHistoryResult> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/pricecharting/products/${encodeURIComponent(input.productId)}/prices`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        observedOn: input.observedOn,
        prices: input.prices,
        ...(input.syncCurrent ? { syncCurrent: true } : {}),
      }),
    },
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<ManualPriceHistoryResult>;
}

export async function syncPricechartingGuide(
  key: string,
): Promise<PricechartingGuideSyncResult> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/pricecharting/sync`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
      timeoutMs: 300_000,
    },
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<PricechartingGuideSyncResult>;
}
