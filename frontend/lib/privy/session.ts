import { backendFetch, getApiUrl } from "@/lib/core/api/client";
import type { AuthUser } from "@/lib/auth/auth";

type PrivySignOutFn = () => Promise<void>;

let privySignOutHandler: PrivySignOutFn | null = null;
let signOutInProgress = false;

/** Wired by {@link PrivySessionBridge} so `completeSignOut` can clear Privy too. */
export function registerPrivySignOut(handler: PrivySignOutFn | null): void {
  privySignOutHandler = handler;
}

/** Prevents PrivySessionBridge from re-syncing while sign-out is in flight. */
export function isSignOutInProgress(): boolean {
  return signOutInProgress;
}

export function setSignOutInProgress(value: boolean): void {
  signOutInProgress = value;
}

export function getPrivySignOutHandler(): PrivySignOutFn | null {
  return privySignOutHandler;
}

/** Privy access token → `POST /auth/privy/session` → Tokenable session cookie + user. */
export async function syncPrivySession(privyAccessToken: string): Promise<AuthUser> {
  const res = await backendFetch(`${getApiUrl()}/auth/privy/session`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${privyAccessToken}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Privy session sync failed" }));
    throw new Error(
      (err as { message?: string }).message ?? "Privy session sync failed",
    );
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

/** Re-verify Privy token and refresh Tokenable session after wallet link/unlink. */
export async function refreshPrivyAuthSession(
  getAccessToken: () => Promise<string | null>,
): Promise<AuthUser | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return syncPrivySession(token);
}
