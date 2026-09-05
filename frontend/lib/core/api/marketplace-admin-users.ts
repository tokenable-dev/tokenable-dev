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

export type AdminUserRoleFilter = "partner" | "individual";
export type AdminUserAccountStatusFilter =
  | "all"
  | "active"
  | "restricted"
  | "suspended";

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

export type AdminUserPartnerInfo = {
  id: string;
  displayName: string;
  walletAddress: string;
  isActive: boolean;
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
  role: "partner" | "individual";
  partner: AdminUserPartnerInfo | null;
  custodyCardCount: number;
  accountStatus: "active";
  strikeCount: number;
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
  role?: AdminUserRoleFilter;
  accountStatus?: AdminUserAccountStatusFilter;
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
  if (params.role) sp.set("role", params.role);
  if (params.accountStatus && params.accountStatus !== "all") {
    sp.set("accountStatus", params.accountStatus);
  }
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

/** Display-only short id matching admin users mockup (U-xxxxx). */
export function formatAdminUserShortId(userId: string): string {
  const hex = userId.replace(/-/g, "").slice(0, 5).toUpperCase();
  return `U-${hex}`;
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
  if (status === "approved") return "검수 통과";
  if (status === "pending") return "심사 중";
  if (status === "rejected") return "실패";
  return "해당 없음";
}

export function formatAdminJoinDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function userInitials(name: string | null, email: string): string {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const local = formatAdminUserEmail(email).replace(/\(wallet.*$/i, "").trim();
  return local.slice(0, 2).toUpperCase() || "?";
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
