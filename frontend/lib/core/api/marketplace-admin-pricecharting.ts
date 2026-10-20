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
