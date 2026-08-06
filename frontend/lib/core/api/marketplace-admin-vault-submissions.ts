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

export type AdminPsaArrivalReviewPackage = {
  publicId: string;
  id: string;
  status: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  certs: string[];
};

export type AdminPsaArrivalReview = {
  id: string;
  gmailMessageId: string;
  subject: string | null;
  fromAddress: string | null;
  certs: string[];
  unmatchedCerts: string[];
  matchedPublicIds: string[];
  ingestNote: string | null;
  status: string;
  reviewedAt: string | null;
  createdAt: string;
  packages: AdminPsaArrivalReviewPackage[];
};

export async function listAdminPsaArrivalReviews(
  status: "pending" | "confirmed" | "dismissed" = "pending",
): Promise<AdminPsaArrivalReview[]> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/vault-submissions/arrival-reviews?status=${encodeURIComponent(status)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`arrival-reviews failed: ${res.status}`);
  return res.json();
}

export async function adminConfirmPsaArrivalReview(
  reviewId: string,
): Promise<{
  review: AdminPsaArrivalReview;
  markedPublicIds: string[];
  skippedPublicIds: string[];
  unmatchedCerts: string[];
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/vault-submissions/arrival-reviews/${encodeURIComponent(reviewId)}/confirm`,
    { method: "POST", credentials: "include" },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `confirm failed: ${res.status}`);
  }
  return res.json();
}

export async function adminDismissPsaArrivalReview(
  reviewId: string,
): Promise<AdminPsaArrivalReview> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/vault-submissions/arrival-reviews/${encodeURIComponent(reviewId)}/dismiss`,
    { method: "POST", credentials: "include" },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `dismiss failed: ${res.status}`);
  }
  return res.json();
}

export type AdminVaultMintQueueItem = {
  itemId: string;
  submissionId: string;
  publicId: string;
  packageStatus: string;
  itemStatus: string;
  cert: string;
  name: string | null;
  grade: string | null;
  imageUrl: string | null;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  updatedAt: string;
};

export type AdminVaultMintAndDeliverResult = {
  submissionId: string;
  publicId: string;
  itemId: string;
  cert: string;
  tokenId: number;
  tokenURI: string;
  vaultRef: string;
  mintTxHash: string;
  deliverTxHash: string | null;
  recipientAddress: string;
  chainId: number;
  adoptedExisting?: boolean;
  alreadyWithUser?: boolean;
};

export async function listAdminVaultMintQueue(params?: {
  q?: string;
}): Promise<AdminVaultMintQueueItem[]> {
  const sp = new URLSearchParams();
  if (params?.q?.trim()) sp.set("q", params.q.trim());
  const qs = sp.toString();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/vault-submissions/mint-queue${qs ? `?${qs}` : ""}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`mint-queue failed: ${res.status}`);
  return res.json();
}

export async function adminMintAndDeliverVaultItem(
  idOrPublicId: string,
  itemId: string,
): Promise<AdminVaultMintAndDeliverResult> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/vault-submissions/${encodeURIComponent(idOrPublicId)}/items/${encodeURIComponent(itemId)}/mint-and-deliver`,
    {
      method: "POST",
      credentials: "include",
      timeoutMs: 180_000,
    },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `mint-and-deliver failed: ${res.status}`);
  }
  return res.json();
}

/** TEST: insert Items Received into Gmail + run one poll. */
export async function adminInjectPsaReceivedTestMail(input: {
  cert: string;
  cardLabel?: string;
}): Promise<{
  messageId: string;
  cert: string;
  poll: { processed: number; queued: string[]; skippedLock?: boolean };
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/vault-submissions/arrival-reviews/test-inject`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cert: input.cert.trim(),
        cardLabel: input.cardLabel?.trim() || undefined,
      }),
    },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `test-inject failed: ${res.status}`);
  }
  return res.json();
}
