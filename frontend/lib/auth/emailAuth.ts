import { backendFetch, getApiUrl } from "../core/api/client";
import type { AuthUser } from "./auth";

async function parseAuthError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({ message: fallback }));
  const message =
    (err as { message?: string | string[] }).message ?? fallback;
  throw new Error(Array.isArray(message) ? message.join(", ") : message);
}

export interface RegisterEmailResult {
  ok: true;
  email: string;
  message: string;
}

export async function registerWithEmail(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<RegisterEmailResult> {
  const res = await backendFetch(`${getApiUrl()}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    await parseAuthError(res, "Registration failed");
  }
  return res.json() as Promise<RegisterEmailResult>;
}

export async function loginWithEmail(params: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const res = await backendFetch(`${getApiUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    await parseAuthError(res, "Sign in failed");
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export async function resendVerificationEmailPublic(email: string): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/auth/resend-verification-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    await parseAuthError(res, "Failed to resend verification email");
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    await parseAuthError(res, "Could not send reset email");
  }
}

export async function resetPasswordWithToken(params: {
  token: string;
  password: string;
}): Promise<AuthUser> {
  const res = await backendFetch(`${getApiUrl()}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    await parseAuthError(res, "Could not reset password");
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export async function changePassword(params: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    await parseAuthError(res, "Could not change password");
  }
}
