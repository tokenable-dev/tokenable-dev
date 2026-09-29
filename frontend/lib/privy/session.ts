import { backendFetch, getApiUrl } from "@/lib/core/api/client";
import type { AuthUser } from "@/lib/auth/auth";

type PrivySignOutFn = () => Promise<void>;

let privySignOutHandler: PrivySignOutFn | null = null;
type PrivyAccessTokenFn = () => Promise<string | null>;
let privyAccessTokenFn: PrivyAccessTokenFn | null = null;
let signOutInProgress = false;

const SUPPRESS_PRIVY_SYNC_KEY = "tk_suppress_privy_sync";
let suppressPrivySessionSync = false;

function readSuppressSyncFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SUPPRESS_PRIVY_SYNC_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSuppressSyncToStorage(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) sessionStorage.setItem(SUPPRESS_PRIVY_SYNC_KEY, "1");
    else sessionStorage.removeItem(SUPPRESS_PRIVY_SYNC_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * After Sign out, block POST /auth/privy/session until the user completes a fresh
 * Privy login — otherwise a lingering MetaMask Privy session re-logs wallet.
 */
export function suppressPrivySessionSyncAfterSignOut(): void {
  suppressPrivySessionSync = true;
  writeSuppressSyncToStorage(true);
}

export function resumePrivySessionSync(): void {
  suppressPrivySessionSync = false;
  writeSuppressSyncToStorage(false);
}

export function isPrivySessionSyncSuppressed(): boolean {
  if (suppressPrivySessionSync) return true;
  return readSuppressSyncFromStorage();
}

export function registerPrivyAccessToken(getter: PrivyAccessTokenFn | null): void {
  privyAccessTokenFn = getter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait until Privy logout cleared the access token (mobile MetaMask can lag). */
export async function waitForPrivyAccessTokenCleared(
  maxMs = 4_000,
): Promise<void> {
  const get = privyAccessTokenFn;
  if (!get) return;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const token = await get().catch(() => null);
    if (!token) return;
    await sleep(120);
  }
}

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
