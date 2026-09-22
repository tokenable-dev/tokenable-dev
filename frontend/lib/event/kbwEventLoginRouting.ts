import { fetchKbwMysteryCardStatus } from "@/lib/core/api/kbw-mystery-card";
import { PORTFOLIO_PATH } from "@/lib/portfolio/portfolioPaths";

/** After KBW Stage-2 login, defer path choice until session + wallet are ready. */
export const KBW_POST_LOGIN_ROUTE_KEY = "tk_kbw_post_login_route";

export const KBW_EVENT_PORTFOLIO_ASSETS_PATH = `${PORTFOLIO_PATH}?tab=assets`;

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
