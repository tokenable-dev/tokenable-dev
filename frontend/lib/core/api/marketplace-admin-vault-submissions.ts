import { backendFetch, getApiUrl } from "./client";

export type AdminVaultSubmissionItem = {
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

export type AdminVaultSubmission = {
  id: string;
  publicId: string;
  status: string;
  scenario: string;
  carrier: string | null;
  trackingNumber: string | null;
  shipDate: string | null;
  shippedAt: string | null;
  packingSlipDownloadedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  items: AdminVaultSubmissionItem[];
};

export type AdminVaultSubmissionCounts = Record<string, number>;

export async function getAdminVaultSubmissionCounts(): Promise<AdminVaultSubmissionCounts> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/admin/vault-submissions/counts`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`counts failed: ${res.status}`);
  return res.json();
}

export async function listAdminVaultSubmissions(params?: {
  status?: string;
  q?: string;
}): Promise<AdminVaultSubmission[]> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.q) sp.set("q", params.q);
  const qs = sp.toString();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/vault-submissions${qs ? `?${qs}` : ""}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  return res.json();
}

export async function getAdminVaultSubmission(
  idOrPublicId: string,
): Promise<AdminVaultSubmission> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/vault-submissions/${encodeURIComponent(idOrPublicId)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`get failed: ${res.status}`);
  return res.json();
}

export async function adminMarkVaultSubmissionArrived(
  idOrPublicId: string,
): Promise<AdminVaultSubmission> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/vault-submissions/${encodeURIComponent(idOrPublicId)}/arrived`,
    { method: "POST", credentials: "include" },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `arrived failed: ${res.status}`);
  }
  return res.json();
}

export async function adminSetVaultSubmissionStatus(
  idOrPublicId: string,
  status: string,
): Promise<AdminVaultSubmission> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/vault-submissions/${encodeURIComponent(idOrPublicId)}/status`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `status failed: ${res.status}`);
  }
  return res.json();
}

export async function adminSetVaultSubmissionItemStatus(
  idOrPublicId: string,
  itemId: string,
  body: { status: string; rejectionReason?: string },
): Promise<AdminVaultSubmission> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/vault-submissions/${encodeURIComponent(idOrPublicId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `item status failed: ${res.status}`);
  }
  return res.json();
}
