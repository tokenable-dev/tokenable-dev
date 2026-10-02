import { backendFetch, getApiUrl } from "./client";

export type AdminBulkMintJobStatus =
  | "pending"
  | "preparing"
  | "ready_to_commit"
  | "committing"
  | "completed"
  | "failed";

export type AdminBulkMintItemStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "minting"
  | "minted"
  | "listed"
  | "prepare_failed"
  | "mint_failed"
  | "list_failed"
  | "skipped";

export type AdminBulkMintSaleStatus =
  | "listed"
  | "sold"
  | "cancelled"
  | "expired"
  | "none";

export type AdminBulkMintJobItem = {
  id: string;
  jobId: string;
  certNumber: string;
  listPriceUsdc: string;
  status: AdminBulkMintItemStatus;
  saleStatus?: AdminBulkMintSaleStatus;
  tokenUri: string | null;
  vaultRef: string | null;
  tokenId: string | null;
  txHash: string | null;
  orderHash: string | null;
  vaultCycleId: string | null;
  errorMessage: string | null;
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminBulkMintJob = {
  id: string;
  status: AdminBulkMintJobStatus;
  partnerId: string;
  partnerDisplayName: string | null;
  partnerWalletAddress: string | null;
  chainId: number;
  itemCount: number;
  preparedCount: number;
  mintedCount: number;
  listedCount: number;
  failedCount: number;
  errorMessage: string | null;
  items?: AdminBulkMintJobItem[];
  createdAt: string;
  updatedAt: string;
};

export type AdminBulkMintJobSummary = Omit<AdminBulkMintJob, "items">;

export type AdminPartnerInventoryItem = {
  itemId: string;
  jobId: string;
  certNumber: string;
  listPriceUsdc: string;
  tokenId: string | null;
  orderHash: string | null;
  itemStatus: string;
  saleStatus: AdminBulkMintSaleStatus;
  updatedAt: string;
};

async function parseAdminError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  const body = err as { message?: string | string[] };
  const msg = Array.isArray(body.message)
    ? body.message.join(", ")
    : body.message;
  throw new Error(msg ?? fallback);
}

export async function listAdminBulkMintJobs(params?: {
  partnerId?: string;
  limit?: number;
}): Promise<AdminBulkMintJobSummary[]> {
  const sp = new URLSearchParams();
  if (params?.partnerId) sp.set("partnerId", params.partnerId);
  if (params?.limit != null) sp.set("limit", String(params.limit));
  const q = sp.toString();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/bulk-mint/jobs${q ? `?${q}` : ""}`,
  );
  if (!res.ok) await parseAdminError(res, "Failed to list bulk mint jobs");
  return res.json() as Promise<AdminBulkMintJobSummary[]>;
}

export async function getAdminPartnerInventory(
  partnerId: string,
): Promise<AdminPartnerInventoryItem[]> {
  const sp = new URLSearchParams({ partnerId });
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/bulk-mint/inventory?${sp.toString()}`,
  );
  if (!res.ok) await parseAdminError(res, "Failed to load partner inventory");
  return res.json() as Promise<AdminPartnerInventoryItem[]>;
}

export async function postAdminBulkMintJobJson(params: {
  partnerId: string;
  items: Array<{ certNumber: string; price: string }>;
}): Promise<AdminBulkMintJob> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/admin/bulk-mint/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) await parseAdminError(res, "Failed to create bulk mint job");
  return res.json() as Promise<AdminBulkMintJob>;
}

export async function postAdminBulkMintJobFile(params: {
  partnerId: string;
  file: File;
}): Promise<AdminBulkMintJob> {
  const form = new FormData();
  form.append("partnerId", params.partnerId);
  form.append("file", params.file);
  const res = await backendFetch(`${getApiUrl()}/marketplace/admin/bulk-mint/jobs`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) await parseAdminError(res, "Failed to create bulk mint job");
  return res.json() as Promise<AdminBulkMintJob>;
}

export async function getAdminBulkMintJob(jobId: string): Promise<AdminBulkMintJob> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/bulk-mint/jobs/${encodeURIComponent(jobId)}`,
  );
  if (!res.ok) await parseAdminError(res, "Failed to load bulk mint job");
  return res.json() as Promise<AdminBulkMintJob>;
}

export async function postAdminBulkMintPrepare(
  jobId: string,
): Promise<AdminBulkMintJob> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/bulk-mint/jobs/${encodeURIComponent(jobId)}/prepare`,
    { method: "POST" },
  );
  if (!res.ok) await parseAdminError(res, "Failed to start prepare");
  return res.json() as Promise<AdminBulkMintJob>;
}

export async function postAdminBulkMintCommit(
  jobId: string,
): Promise<AdminBulkMintJob> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/bulk-mint/jobs/${encodeURIComponent(jobId)}/commit`,
    { method: "POST" },
  );
  if (!res.ok) await parseAdminError(res, "Failed to commit bulk mint");
  return res.json() as Promise<AdminBulkMintJob>;
}

export async function postAdminBulkMintCancelListing(params: {
  jobId: string;
  itemId: string;
}): Promise<AdminBulkMintJob> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/bulk-mint/jobs/${encodeURIComponent(params.jobId)}/items/${encodeURIComponent(params.itemId)}/cancel-listing`,
    { method: "POST" },
  );
  if (!res.ok) await parseAdminError(res, "Failed to cancel listing");
  return res.json() as Promise<AdminBulkMintJob>;
}
