import { backendFetch, getApiUrl } from "./client";

export type DataInventoryDomainId =
  | "catalog"
  | "markets"
  | "portfolio"
  | "trading"
  | "people"
  | "vault"
  | "other";

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

export type DataInventorySchemaColumn = {
  name: string;
  dataType: string;
  primaryKey: boolean;
  unique: boolean;
  foreignKey: boolean;
};

export type DataInventorySchemaTable = {
  table: string;
  label: string;
  domain: DataInventoryDomainId;
  description: string | null;
  howAccumulated: string | null;
  rowCount: number;
  columns: DataInventorySchemaColumn[];
};

export type DataInventorySchemaEdge = {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  kind: "fk" | "logical";
  label: string;
};

export type DataInventorySchemaResponse = {
  generatedAt: string;
  tables: DataInventorySchemaTable[];
  edges: DataInventorySchemaEdge[];
};

export type AdminMarketplaceResetResult = {
  truncatedTables: string[];
  skippedMissingTables: string[];
  rowCountsBefore: Record<string, number>;
};

export type AdminDataInventoryRowsResult = {
  table: string;
  label: string;
  description: string | null;
  domain: DataInventoryDomainId;
  columns: string[];
  redactedColumns: string[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: Record<string, unknown>[];
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

export async function getAdminDataInventorySchema(): Promise<DataInventorySchemaResponse> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/data-inventory/schema`,
  );
  if (!res.ok) await parseAdminError(res, "Failed to load schema map");
  return res.json() as Promise<DataInventorySchemaResponse>;
}

export async function getAdminDataInventoryTableRows(
  table: string,
  page = 1,
  pageSize = 50,
  compact = false,
): Promise<AdminDataInventoryRowsResult> {
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (compact) qs.set("compact", "1");
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/data-inventory/tables/${encodeURIComponent(table)}/rows?${qs}`,
  );
  if (!res.ok) await parseAdminError(res, "Failed to load table rows");
  return res.json() as Promise<AdminDataInventoryRowsResult>;
}

/** Dev/staging only — wipe marketplace/vault after RWA redeploy (keeps users). */
export async function postAdminResetForNewContract(
  password: string,
): Promise<AdminMarketplaceResetResult> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/data-inventory/reset-for-new-contract`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    },
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to reset marketplace data");
  }
  return res.json() as Promise<AdminMarketplaceResetResult>;
}
