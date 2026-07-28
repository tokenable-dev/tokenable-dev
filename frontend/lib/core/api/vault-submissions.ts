import { backendFetch, getApiUrl } from "./client";

export type VaultSubmissionApiItem = {
  id: string;
  cert: string;
  name: string | null;
  grade: string | null;
  imageUrl: string | null;
  status: string;
  rejectionReason: string | null;
  vaultCycleId: string | null;
  sortOrder: number;
};

export type VaultSubmissionApi = {
  id: string;
  publicId: string;
  status: string;
  scenario: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
  carrier: string | null;
  trackingNumber: string | null;
  shipDate: string | null;
  shippedAt: string | null;
  packingSlipDownloadedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: VaultSubmissionApiItem[];
};

export type VaultSubmissionCardInput = {
  cert: string;
  name: string;
  grade: number;
  img?: string | null;
  confirmed: boolean;
};

export async function listVaultSubmissions(): Promise<VaultSubmissionApi[]> {
  const res = await backendFetch(`${getApiUrl()}/vault/submissions`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`listVaultSubmissions failed: ${res.status}`);
  return res.json();
}

export async function getVaultSubmission(idOrPublicId: string): Promise<VaultSubmissionApi> {
  const res = await backendFetch(
    `${getApiUrl()}/vault/submissions/${encodeURIComponent(idOrPublicId)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`getVaultSubmission failed: ${res.status}`);
  return res.json();
}

export async function upsertVaultSubmissionDraft(body: {
  publicId?: string;
  cards: VaultSubmissionCardInput[];
}): Promise<VaultSubmissionApi> {
  const res = await backendFetch(`${getApiUrl()}/vault/submissions/draft`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `upsertVaultSubmissionDraft failed: ${res.status}`);
  }
  return res.json();
}

export async function markVaultPackingSlipDownloaded(
  idOrPublicId: string,
): Promise<VaultSubmissionApi> {
  const res = await backendFetch(
    `${getApiUrl()}/vault/submissions/${encodeURIComponent(idOrPublicId)}/packing-slip`,
    { method: "POST", credentials: "include" },
  );
  if (!res.ok) throw new Error(`markVaultPackingSlipDownloaded failed: ${res.status}`);
  return res.json();
}

export async function registerVaultSubmissionTracking(
  idOrPublicId: string,
  body: { carrier: "fedex" | "dhl" | "ups"; trackingNumber: string; shipDate?: string },
): Promise<VaultSubmissionApi> {
  const res = await backendFetch(
    `${getApiUrl()}/vault/submissions/${encodeURIComponent(idOrPublicId)}/tracking`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `registerVaultSubmissionTracking failed: ${res.status}`);
  }
  return res.json();
}
