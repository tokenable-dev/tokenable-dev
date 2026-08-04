import { backendFetch, getApiUrl } from "../core/api/client";
import type { AuthProviderLink, LinkedWallet } from "./wallets";

export type KycStatus = "none" | "pending" | "approved" | "rejected";

export type EmailNotifPrefs = {
  trades: boolean;
  bids: boolean;
  price: boolean;
  vault: boolean;
};

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  walletAddress: string | null;
  walletLinkedAt: string | null;
  wallets?: LinkedWallet[];
  authProviders?: AuthProviderLink[];
  emailVerified: boolean;
  hasPassword: boolean;
  privyId?: string | null;
  kycStatus?: KycStatus;
  kycVerifiedAt?: string | null;
  kycProvider?: string | null;
  lastPrivySyncAt?: string | null;
  marketingEmailsOptIn?: boolean;
  emailNotificationsEnabled?: boolean;
  emailNotifPrefs?: EmailNotifPrefs;
}

export type UpdateProfileInput = {
  name?: string;
  marketingEmailsOptIn?: boolean;
  emailNotificationsEnabled?: boolean;
  emailNotifPrefs?: Partial<EmailNotifPrefs>;
};

/** Returns null when unauthenticated (`/auth/session` → `{ user: null }`). */
export async function fetchAuthMe(): Promise<AuthUser | null> {
  const res = await backendFetch(`${getApiUrl()}/auth/session`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Session error" }));
    throw new Error((err as { message?: string }).message ?? "Session error");
  }
  const data = (await res.json()) as { user: AuthUser | null };
  return data.user ?? null;
}

export { syncPrivySession } from "@/lib/privy/session";

export async function logoutAuth(): Promise<void> {
  await backendFetch(`${getApiUrl()}/auth/logout`, { method: "POST" });
}

export async function deleteAccount(): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/auth/delete-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Delete failed" }));
    const message =
      (err as { message?: string | string[] }).message ?? "Delete failed";
    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }
}

export async function updateAuthProfile(
  input: UpdateProfileInput,
): Promise<AuthUser> {
  const res = await backendFetch(`${getApiUrl()}/auth/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Update failed" }));
    const message =
      (err as { message?: string | string[] }).message ?? "Update failed";
    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export async function uploadAuthAvatar(file: File): Promise<AuthUser> {
  const body = new FormData();
  body.append("file", file);
  const res = await backendFetch(`${getApiUrl()}/auth/avatar`, {
    method: "POST",
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Upload failed" }));
    const message =
      (err as { message?: string | string[] }).message ?? "Upload failed";
    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}
