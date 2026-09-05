import { backendFetch, getApiUrl } from "./client";

export async function getMarketplaceAdminSession(): Promise<{
  authenticated: boolean;
  username: string | null;
}> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/admin/auth/session`);
  if (!res.ok) {
    return { authenticated: false, username: null };
  }
  return res.json() as Promise<{ authenticated: boolean; username: string | null }>;
}

export async function loginMarketplaceAdmin(input: {
  username: string;
  password: string;
}): Promise<{ ok: true; username: string; expiresIn: number }> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Invalid admin credentials");
  }
  return res.json() as Promise<{ ok: true; username: string; expiresIn: number }>;
}

export async function logoutMarketplaceAdmin(): Promise<void> {
  await backendFetch(`${getApiUrl()}/marketplace/admin/auth/logout`, {
    method: "POST",
  });
}
