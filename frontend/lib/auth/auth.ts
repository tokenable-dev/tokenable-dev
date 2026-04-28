import { getApiUrl } from "../core/api";

function backendFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, credentials: "include" });
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  walletAddress: string | null;
  walletLinkedAt: string | null;
  /** 플랫폼 이메일 인증(메일 링크) 완료 시각, 없으면 미인증 */
  platformEmailVerifiedAt: string | null;
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

export async function linkWalletToAccount(address: string): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/auth/wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Link failed" }));
    throw new Error((err as { message?: string }).message ?? "Link failed");
  }
}

export async function unlinkWalletFromAccount(): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/auth/wallet`, {
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
