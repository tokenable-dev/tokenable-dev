import { backendFetch, getApiUrl } from "./client";

export type DataInventoryDomainId =
  | "catalog"
  | "markets"
  | "portfolio"
  | "trading"
  | "people"
  | "vault";

export type DataInventoryDomain = {
  id: DataInventoryDomainId;
  label: string;
  summary: string;
};

export type DataStoreInventoryRow = {
  id: string;
  table: string;
  domain: DataInventoryDomainId;
  label: string;
  description: string;
  howAccumulated: string;
  adminPagePath: string | null;
  rowCount: number;
  oldestAt: string | null;
  newestAt: string | null;
  lastActivityAt: string | null;
  highlights: Record<string, string | number | boolean | null>;
};

export type DataInventoryResponse = {
  generatedAt: string;
  domains: DataInventoryDomain[];
  stores: DataStoreInventoryRow[];
  totals: {
    storeCount: number;
    rowCount: number;
  };
};

async function parseAdminError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error((err as { message?: string }).message ?? fallback);
}

export async function getAdminDataInventory(): Promise<DataInventoryResponse> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/data-inventory`,
  );
  if (!res.ok) await parseAdminError(res, "Failed to load data inventory");
  return res.json() as Promise<DataInventoryResponse>;
}
