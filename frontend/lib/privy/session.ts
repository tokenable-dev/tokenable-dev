import { backendFetch, getApiUrl } from "@/lib/core/api/client";
import type { AuthUser } from "@/lib/auth/auth";

type PrivySignOutFn = () => Promise<void>;

let privySignOutHandler: PrivySignOutFn | null = null;
let signOutInProgress = false;

type AuthSignOutListener = () => void;
const authSignOutListeners = new Set<AuthSignOutListener>();

/** Lets PrivySessionBridge drop in-flight sync state after sign-out. */
export function onAuthSignOutComplete(listener: AuthSignOutListener): () => void {
  authSignOutListeners.add(listener);
  return () => {
    authSignOutListeners.delete(listener);
  };
}

export function notifyAuthSignOutComplete(): void {
  for (const listener of authSignOutListeners) listener();
}

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

let walletFlowDepth = 0;
/** Block aligners briefly after a Privy tx modal closes (teardown still mutates `wallets`). */
let walletFlowCooldownUntil = 0;

/**
 * Background wallet aligners (`WalletDataProvider`, `useEnsureAccountWalletActive`) must not
 * call `switchChain` / `setActiveWallet` while a Privy approve/sign UI is open — Privy's
 * `wallets` list churns mid-tx and a switch re-renders its modal tree (hooks crash at Providers).
 */
export function isWalletFlowInProgress(): boolean {
  if (walletFlowDepth > 0) return true;
  return Date.now() < walletFlowCooldownUntil;
}

/** Call after an on-chain wallet prompt completes (before opening the next Privy UI). */
export function extendWalletFlowCooldown(ms: number): void {
  walletFlowCooldownUntil = Math.max(walletFlowCooldownUntil, Date.now() + ms);
}

export async function runWalletFlow<T>(run: () => Promise<T>): Promise<T> {
  walletFlowDepth += 1;
  try {
    return await run();
  } finally {
    walletFlowDepth = Math.max(0, walletFlowDepth - 1);
  }
}

export function getPrivySignOutHandler(): PrivySignOutFn | null {
  return privySignOutHandler;
}

export class PrivySessionSyncError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PrivySessionSyncError";
    this.status = status;
  }
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
    const message =
      (err as { message?: string }).message ?? "Privy session sync failed";
    throw new PrivySessionSyncError(message, res.status);
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
