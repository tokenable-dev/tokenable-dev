import type { AuthUser } from "@/lib/auth/auth";
import {
  isWalletOnlyPlaceholderEmail,
  userNeedsContactEmail,
} from "@/lib/auth/walletOnlyEmail";
import { fetchKbwMysteryCardStatus } from "@/lib/core/api/kbw-mystery-card";
import { isKbwEventActive } from "@/lib/event/kbwEventPeriod";
import { PORTFOLIO_PATH } from "@/lib/portfolio/portfolioPaths";

/** After KBW Stage-2 login, defer path choice until session + wallet are ready. */
export const KBW_POST_LOGIN_ROUTE_KEY = "tk_kbw_post_login_route";

/** Set when the user taps "Log in to Tokenable" on `/event` (survives MetaMask app-switch). */
export const KBW_STAGE2_FLOW_KEY = "tk_kbw_stage2_flow";

/** One-shot flag for Privy `onComplete` after Stage-2 login. */
export const KBW_LOGIN_INTENT_KEY = "tk_kbw_login_intent";

export const KBW_EVENT_PORTFOLIO_ASSETS_PATH = `${PORTFOLIO_PATH}?tab=assets`;

function readDualStorageFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(key) === "1") return true;
    if (localStorage.getItem(key) === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

function writeDualStorageFlag(key: string, on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) {
      sessionStorage.setItem(key, "1");
      localStorage.setItem(key, "1");
    } else {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

export function markKbwPostLoginRoutePending(): void {
  writeDualStorageFlag(KBW_POST_LOGIN_ROUTE_KEY, true);
}

export function clearKbwPostLoginRoutePending(): void {
  writeDualStorageFlag(KBW_POST_LOGIN_ROUTE_KEY, false);
}

export function isKbwPostLoginRoutePending(): boolean {
  return readDualStorageFlag(KBW_POST_LOGIN_ROUTE_KEY);
}

export function markKbwStage2FlowPending(): void {
  writeDualStorageFlag(KBW_STAGE2_FLOW_KEY, true);
}

export function clearKbwStage2FlowPending(): void {
  writeDualStorageFlag(KBW_STAGE2_FLOW_KEY, false);
}

export function isKbwStage2FlowPending(): boolean {
  return readDualStorageFlag(KBW_STAGE2_FLOW_KEY);
}

export function markKbwLoginIntent(): void {
  writeDualStorageFlag(KBW_LOGIN_INTENT_KEY, true);
}

export function consumeKbwLoginIntent(): boolean {
  const had = readDualStorageFlag(KBW_LOGIN_INTENT_KEY);
  writeDualStorageFlag(KBW_LOGIN_INTENT_KEY, false);
  return had;
}

/** True while Stage-2 post-login UI (email or offer) should run. */
export function isKbwEventStage2PostLoginActive(): boolean {
  return isKbwStage2FlowPending() || isKbwPostLoginRoutePending();
}

export function isEventPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/event" || pathname.startsWith("/event/");
}

/** Wallet-only accounts must add a real email before leaving the event login flow. */
export function shouldDeferKbwPostLoginForEmail(
  email: string | null | undefined,
  user?: AuthUser | null,
): boolean {
  if (user) return userNeedsContactEmail(user);
  return isWalletOnlyPlaceholderEmail(email);
}

/** Participated users → portfolio (Used card); others → main for offer modal. */
export async function resolveKbwStage2ReturnPath(
  walletAddress: string | null | undefined,
): Promise<string> {
  const wallet = walletAddress?.trim();
  if (!wallet) return "/";
  try {
    const { burned } = await fetchKbwMysteryCardStatus(wallet);
    return burned ? KBW_EVENT_PORTFOLIO_ASSETS_PATH : "/";
  } catch {
    return "/";
  }
}

/**
 * Finish KBW Stage-2 navigation (home + offer, or portfolio if already participated).
 * Returns true when the pending post-login route was consumed.
 */
export async function completeKbwPostLoginRedirect(opts: {
  walletAddress: string | null | undefined;
  push: (path: string) => void;
  armKbwOffer: () => void;
  clearKbwOffer: () => void;
}): Promise<boolean> {
  if (!isKbwEventActive() || !isKbwPostLoginRoutePending()) return false;

  const path = await resolveKbwStage2ReturnPath(opts.walletAddress);
  if (path === "/") opts.armKbwOffer();
  else opts.clearKbwOffer();

  clearKbwPostLoginRoutePending();
  clearKbwStage2FlowPending();

  const targetPath = path.split("?")[0] || path;
  const here =
    typeof window !== "undefined" ? window.location.pathname : "";
  if (here !== targetPath) opts.push(path);

  return true;
}
