import type { AuthUser } from "@/lib/auth/auth";
import { getPrimaryWalletAddress } from "@/lib/auth/wallets";
import { userNeedsContactEmail } from "@/lib/auth/walletOnlyEmail";
import { fetchKbwMysteryCardStatus } from "@/lib/core/api/kbw-mystery-card";
import { isKbwEventActive } from "@/lib/event/kbwEventPeriod";
import { PORTFOLIO_PATH } from "@/lib/portfolio/portfolioPaths";

/** Stage-2 login in progress (MetaMask app-switch safe: session + localStorage). */
const STAGE2_PENDING_KEY = "tk_kbw_stage2";

/** One-shot: Privy `onComplete` after tapping Stage 2 on `/event`. */
const STAGE2_LOGIN_INTENT_KEY = "tk_kbw_stage2_login_intent";

/** @deprecated — migrated into STAGE2_PENDING_KEY */
const LEGACY_STAGE2_FLOW_KEY = "tk_kbw_stage2_flow";
const LEGACY_POST_LOGIN_ROUTE_KEY = "tk_kbw_post_login_route";
const LEGACY_LOGIN_INTENT_KEY = "tk_kbw_login_intent";

export const KBW_EVENT_PORTFOLIO_ASSETS_PATH = `${PORTFOLIO_PATH}?tab=assets`;

function readDualFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(key) === "1") return true;
    if (localStorage.getItem(key) === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

function writeDualFlag(key: string, on: boolean): void {
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

function migrateLegacyStage2Flags(): boolean {
  const legacy =
    readDualFlag(LEGACY_STAGE2_FLOW_KEY) ||
    readDualFlag(LEGACY_POST_LOGIN_ROUTE_KEY);
  if (!legacy) return false;
  writeDualFlag(STAGE2_PENDING_KEY, true);
  writeDualFlag(LEGACY_STAGE2_FLOW_KEY, false);
  writeDualFlag(LEGACY_POST_LOGIN_ROUTE_KEY, false);
  return true;
}

export function isEventPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/event" || pathname.startsWith("/event/");
}

export function isKbwStage2Pending(): boolean {
  if (readDualFlag(STAGE2_PENDING_KEY)) return true;
  return migrateLegacyStage2Flags();
}

export function beginKbwStage2Login(): void {
  writeDualFlag(STAGE2_PENDING_KEY, true);
  writeDualFlag(STAGE2_LOGIN_INTENT_KEY, true);
}

export function clearKbwStage2(): void {
  writeDualFlag(STAGE2_PENDING_KEY, false);
  writeDualFlag(STAGE2_LOGIN_INTENT_KEY, false);
  writeDualFlag(LEGACY_STAGE2_FLOW_KEY, false);
  writeDualFlag(LEGACY_POST_LOGIN_ROUTE_KEY, false);
  writeDualFlag(LEGACY_LOGIN_INTENT_KEY, false);
}

export function consumeKbwStage2LoginIntent(): boolean {
  const had =
    readDualFlag(STAGE2_LOGIN_INTENT_KEY) ||
    readDualFlag(LEGACY_LOGIN_INTENT_KEY);
  writeDualFlag(STAGE2_LOGIN_INTENT_KEY, false);
  writeDualFlag(LEGACY_LOGIN_INTENT_KEY, false);
  return had;
}

/** Re-arm Stage-2 pending after Privy redirect (idempotent). */
export function ensureKbwStage2Pending(): void {
  writeDualFlag(STAGE2_PENDING_KEY, true);
}

type KbwEventPageFinishOpts = {
  user?: AuthUser | null;
  walletAddress: string | null | undefined;
  push: (path: string) => void;
  armKbwOffer: () => void;
  clearKbwOffer: () => void;
};

function resolveKbwWallet(
  user: AuthUser | null | undefined,
  walletAddress: string | null | undefined,
): string | null {
  const fromArg = walletAddress?.trim();
  if (fromArg) return fromArg;
  return getPrimaryWalletAddress(user) ?? null;
}

/** On `/event`: offer if eligible; already used mystery card → portfolio. */
export async function finishKbwEventOnPage(
  opts: KbwEventPageFinishOpts,
): Promise<void> {
  const wallet = resolveKbwWallet(opts.user, opts.walletAddress);
  const burned = await kbwMysteryCardBurned(wallet);
  clearKbwStage2();
  if (burned) {
    opts.clearKbwOffer();
    opts.push(KBW_EVENT_PORTFOLIO_ASSETS_PATH);
  } else {
    opts.armKbwOffer();
  }
}

/** `/event` email saved after Stage-2 login. */
export async function afterEventContactEmailSaved(
  opts: KbwEventPageFinishOpts,
): Promise<void> {
  if (!isKbwEventActive()) return;
  if (typeof window === "undefined" || !isEventPath(window.location.pathname)) {
    return;
  }
  await finishKbwEventOnPage(opts);
}

async function kbwMysteryCardBurned(
  walletAddress: string | null | undefined,
): Promise<boolean> {
  try {
    const { burned } = await fetchKbwMysteryCardStatus(
      walletAddress?.trim() ?? "",
    );
    return burned === true;
  } catch {
    return false;
  }
}

export type KbwStage2SessionResult =
  | "inactive"
  | "deferred_email"
  | "wait_wallet"
  | "done";

/**
 * Finish Stage-2 once Tokenable session (+ wallet when possible) exists.
 * On `/event`: offer modal if eligible; already used → portfolio assets. Off-event: same rules.
 */
export async function completeKbwStage2Session(opts: {
  user: AuthUser;
  walletAddress: string | null | undefined;
  pathname: string;
  push: (path: string) => void;
  armKbwOffer: () => void;
  clearKbwOffer: () => void;
  /** When true and wallet missing, caller should retry after wallet catch-up. */
  allowWaitForWallet?: boolean;
}): Promise<KbwStage2SessionResult> {
  if (!isKbwEventActive() || !isKbwStage2Pending()) return "inactive";
  if (userNeedsContactEmail(opts.user)) return "deferred_email";

  const wallet = opts.walletAddress?.trim() ?? "";
  if (!wallet && opts.allowWaitForWallet) return "wait_wallet";

  if (isEventPath(opts.pathname)) {
    await finishKbwEventOnPage({
      user: opts.user,
      walletAddress: wallet || opts.walletAddress,
      push: opts.push,
      armKbwOffer: opts.armKbwOffer,
      clearKbwOffer: opts.clearKbwOffer,
    });
    return "done";
  }

  const burned = await kbwMysteryCardBurned(wallet || null);
  clearKbwStage2();

  if (burned) {
    opts.clearKbwOffer();
    const target = KBW_EVENT_PORTFOLIO_ASSETS_PATH.split("?")[0] ?? PORTFOLIO_PATH;
    if (opts.pathname !== target) opts.push(KBW_EVENT_PORTFOLIO_ASSETS_PATH);
  } else {
    opts.armKbwOffer();
    if (opts.pathname !== "/") opts.push("/");
  }

  return "done";
}
