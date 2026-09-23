import { isWalletOnlyPlaceholderEmail } from "@/lib/auth/walletOnlyEmail";
import { fetchKbwMysteryCardStatus } from "@/lib/core/api/kbw-mystery-card";
import { isKbwEventActive } from "@/lib/event/kbwEventPeriod";
import { PORTFOLIO_PATH } from "@/lib/portfolio/portfolioPaths";

/** After KBW Stage-2 login, defer path choice until session + wallet are ready. */
export const KBW_POST_LOGIN_ROUTE_KEY = "tk_kbw_post_login_route";

export const KBW_EVENT_PORTFOLIO_ASSETS_PATH = `${PORTFOLIO_PATH}?tab=assets`;

export function isKbwPostLoginRoutePending(): boolean {
  try {
    return sessionStorage.getItem(KBW_POST_LOGIN_ROUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Wallet-only accounts must add a real email before leaving the event login flow. */
export function shouldDeferKbwPostLoginForEmail(
  email: string | null | undefined,
): boolean {
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

  try {
    sessionStorage.removeItem(KBW_POST_LOGIN_ROUTE_KEY);
  } catch {
    /* ignore */
  }

  const targetPath = path.split("?")[0] || path;
  const here =
    typeof window !== "undefined" ? window.location.pathname : "";
  if (here !== targetPath) opts.push(path);

  return true;
}
