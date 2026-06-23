import { backendFetch, getApiUrl } from "../core/api/client";
import type { LinkedWallet } from "./wallets";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  walletAddress: string | null;
  walletLinkedAt: string | null;
  wallets?: LinkedWallet[];
  emailVerified: boolean;
  hasPassword: boolean;
}

/** 세션 없으면 null (`/auth/session` 은 항상 200 — 미인증 시 `{ user: null }`) */
export async function fetchAuthMe(): Promise<AuthUser | null> {
  const res = await backendFetch(`${getApiUrl()}/auth/session`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Session error" }));
    throw new Error((err as { message?: string }).message ?? "Session error");
  }
  const data = (await res.json()) as { user: AuthUser | null };
  return data.user ?? null;
}

export async function logoutAuth(): Promise<void> {
  await backendFetch(`${getApiUrl()}/auth/logout`, { method: "POST" });
}

/** 브라우저에서 document.location 으로 이동 (Google OAuth) */
export function getGoogleAuthHref(): string {
  return `${getApiUrl()}/auth/google`;
}

export async function unlinkWalletFromAccount(address: string): Promise<void> {
  const enc = encodeURIComponent(address);
  const res = await backendFetch(`${getApiUrl()}/auth/wallet?address=${enc}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Unlink failed" }));
    throw new Error((err as { message?: string }).message ?? "Unlink failed");
  }
}

/** 인증 메일 재발송 (로그인 필요, 짧은 쿨다운) */
export async function sendVerificationEmail(): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/auth/send-verification-email`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Send failed" }));
    throw new Error((err as { message?: string }).message ?? "Send failed");
  }
}

export async function deleteAccount(params?: { password?: string }): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/auth/delete-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params ?? {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Delete failed" }));
    const message =
      (err as { message?: string | string[] }).message ?? "Delete failed";
    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }
}
