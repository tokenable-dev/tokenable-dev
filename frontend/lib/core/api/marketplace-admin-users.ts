import { backendFetch, getApiUrl } from "./client";

export type AdminPrivyAuthMethod =
  | "wallet"
  | "google"
  | "email"
  | "google+email"
  | "apple"
  | "other"
  | "legacy";

export type AdminUserFilter =
  | "all"
  | "privy"
  | "legacy"
  | "google"
  | "email"
  | "wallet"
  | "verified"
  | "unverified"
  | "with_wallet"
  | "kyc_approved"
  | "kyc_pending"
  | "kyc_rejected"
  | "kyc_none";

export type AdminAuthProviderRow = {
  id: string;
  providerType: string;
  providerSubject: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  isVerified: boolean;
  linkedAt: string;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  emailVerified: boolean;
  privyAuthMethod: AdminPrivyAuthMethod;
  privyId: string | null;
  authProviderTypes: string[];
  kycStatus: "none" | "pending" | "approved" | "rejected";
  kycVerifiedAt: string | null;
  walletAddress: string | null;
  walletLinkedAt: string | null;
  walletCount: number;
  watchlistCount: number;
  lastPrivySyncAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserWalletRow = {
  id: string;
  walletAddress: string;
  isPrimary: boolean;
  chainType: string;
  walletKind: "embedded" | "external";
  walletClient: string | null;
  connectorType: string | null;
  source: "privy_sync" | "admin" | "legacy";
  privyWalletId: string | null;
  linkedAt: string;
};

export type AdminKycEventRow = {
  id: string;
  status: AdminUserSummary["kycStatus"];
  provider: string;
  externalId: string | null;
  reason: string | null;
  source: string | null;
  createdAt: string;
};

export type AdminUserDetail = AdminUserSummary & {
  wallets: AdminUserWalletRow[];
  authProviders: AdminAuthProviderRow[];
  watchlistKeys: string[];
  hasPassword: boolean;
  googleId: string | null;
  kycProvider: string | null;
  kycExternalId: string | null;
  kycRejectionReason: string | null;
  kycEvents: AdminKycEventRow[];
};

export type AdminUserStats = {
  total: number;
  privy: number;
  legacy: number;
  google: number;
  emailOtp: number;
  walletLogin: number;
  withWallet: number;
  kycApproved: number;
  kycPending: number;
  kycRejected: number;
  kycNone: number;
  verified: number;
  unverified: number;
};

async function parseAdminError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error((err as { message?: string }).message ?? fallback);
}

export async function getAdminUserStats(): Promise<AdminUserStats> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/admin/users/stats`);
  if (!res.ok) await parseAdminError(res, "Failed to load user stats");
  return res.json() as Promise<AdminUserStats>;
}

export async function getAdminUsers(params: {
  q?: string;
  filter?: AdminUserFilter;
  page?: number;
  limit?: number;
}): Promise<{
  items: AdminUserSummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}> {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.filter && params.filter !== "all") sp.set("filter", params.filter);
  if (params.page != null) sp.set("page", String(params.page));
  if (params.limit != null) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/users${qs ? `?${qs}` : ""}`,
  );
  if (!res.ok) await parseAdminError(res, "Failed to load users");
  return res.json() as Promise<{
    items: AdminUserSummary[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }>;
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/users/${encodeURIComponent(userId)}`,
  );
  if (!res.ok) await parseAdminError(res, "Failed to load user");
  return res.json() as Promise<AdminUserDetail>;
}

export async function patchAdminUser(
  userId: string,
  body: { name?: string | null; emailVerified?: boolean },
): Promise<AdminUserDetail> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) await parseAdminError(res, "Failed to update user");
  return res.json() as Promise<AdminUserDetail>;
}

export async function postAdminUserKyc(
  userId: string,
  body: {
    status: AdminUserSummary["kycStatus"];
    reason?: string | null;
  },
): Promise<AdminUserDetail> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/users/${encodeURIComponent(userId)}/kyc`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) await parseAdminError(res, "Failed to update KYC");
  return res.json() as Promise<AdminUserDetail>;
}

export async function deleteAdminUser(userId: string): Promise<{ ok: true }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/users/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) await parseAdminError(res, "Failed to delete user");
  return res.json() as Promise<{ ok: true }>;
}

export const postAdminForceVerifyEmail = (userId: string) =>
  backendFetch(
    `${getApiUrl()}/marketplace/admin/users/${encodeURIComponent(userId)}/force-verify-email`,
    { method: "POST" },
  ).then(async (res) => {
    if (!res.ok) await parseAdminError(res, "Failed to verify email");
    return res.json() as Promise<AdminUserDetail>;
  });

export async function postAdminLinkUserWallet(
  userId: string,
  address: string,
): Promise<AdminUserDetail> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/users/${encodeURIComponent(userId)}/wallets`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    },
  );
  if (!res.ok) await parseAdminError(res, "Failed to link wallet");
  return res.json() as Promise<AdminUserDetail>;
}

export async function deleteAdminUserWallet(
  userId: string,
  address: string,
): Promise<AdminUserDetail> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/users/${encodeURIComponent(userId)}/wallets/${encodeURIComponent(address)}`,
    { method: "DELETE" },
  );
  if (!res.ok) await parseAdminError(res, "Failed to unlink wallet");
  return res.json() as Promise<AdminUserDetail>;
}

export async function deleteAdminUserWatchlistItem(
  userId: string,
  collectionKey: string,
): Promise<AdminUserDetail> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/users/${encodeURIComponent(userId)}/watchlist/${encodeURIComponent(collectionKey)}`,
    { method: "DELETE" },
  );
  if (!res.ok) await parseAdminError(res, "Failed to remove watchlist item");
  return res.json() as Promise<AdminUserDetail>;
}

/** Mask wallet-only Privy placeholder emails for admin display. */
export function formatAdminUserEmail(email: string): string {
  if (email.toLowerCase().endsWith("@privy.wallet")) {
    const wallet = email.replace(/@privy\.wallet$/i, "");
    if (wallet.length >= 10) {
      return `${wallet.slice(0, 6)}…${wallet.slice(-4)} (wallet)`;
    }
    return `${wallet} (wallet)`;
  }
  return email;
}

export function formatPrivyAuthMethod(method: AdminPrivyAuthMethod): string {
  const labels: Record<AdminPrivyAuthMethod, string> = {
    wallet: "Wallet",
    google: "Google",
    email: "Email",
    "google+email": "Google+Email",
    apple: "Apple",
    other: "Multi",
    legacy: "Legacy",
  };
  return labels[method];
}

export function formatAuthProviderLabel(type: string): string {
  const labels: Record<string, string> = {
    privy: "Privy",
    email: "Email",
    google_oauth: "Google",
    apple_oauth: "Apple",
    wallet: "Wallet",
    sms: "SMS",
    passkey: "Passkey",
    email_password: "Password",
  };
  return labels[type] ?? type.replace(/_/g, " ");
}

export function formatKycStatus(status: AdminUserSummary["kycStatus"]): string {
  if (status === "approved") return "KYC ✓";
  if (status === "pending") return "KYC …";
  if (status === "rejected") return "KYC ✕";
  return "KYC —";
}

export function privyAuthMethodBadgeClass(method: AdminPrivyAuthMethod): string {
  if (method === "legacy") {
    return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  }
  if (method === "wallet") {
    return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
  }
  return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
}
