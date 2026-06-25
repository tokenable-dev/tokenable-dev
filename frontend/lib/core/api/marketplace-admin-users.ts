import { backendFetch, getApiUrl } from "./client";

export type AdminUserSignupType = "google" | "email" | "google+email";

export type AdminUserFilter =
  | "all"
  | "google"
  | "email"
  | "verified"
  | "unverified";

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  emailVerified: boolean;
  googleId: string | null;
  hasPassword: boolean;
  signupType: AdminUserSignupType;
  walletAddress: string | null;
  walletLinkedAt: string | null;
  walletCount: number;
  watchlistCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserWalletRow = {
  id: string;
  walletAddress: string;
  isPrimary: boolean;
  linkedAt: string;
};

export type AdminUserDetail = AdminUserSummary & {
  wallets: AdminUserWalletRow[];
  watchlistKeys: string[];
  pendingEmailVerification: boolean;
  pendingPasswordReset: boolean;
};

export type AdminUserStats = {
  total: number;
  verified: number;
  unverified: number;
  googleOnly: number;
  emailPassword: number;
  withWallet: number;
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

export async function deleteAdminUser(userId: string): Promise<{ ok: true }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/users/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) await parseAdminError(res, "Failed to delete user");
  return res.json() as Promise<{ ok: true }>;
}

async function postAdminUserAction(
  userId: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/users/${encodeURIComponent(userId)}/${path}`,
    {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  if (!res.ok) await parseAdminError(res, "Action failed");
  return res.json();
}

export const postAdminResendVerification = (userId: string) =>
  postAdminUserAction(userId, "resend-verification");

export const postAdminSendPasswordReset = (userId: string) =>
  postAdminUserAction(userId, "send-password-reset");

export const postAdminSetUserPassword = (userId: string, password: string) =>
  postAdminUserAction(userId, "set-password", { password });

export const postAdminForceVerifyEmail = (userId: string) =>
  postAdminUserAction(userId, "force-verify-email");

export const postAdminClearPendingTokens = (userId: string) =>
  postAdminUserAction(userId, "clear-pending-tokens");

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
