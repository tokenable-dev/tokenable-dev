/** Set to `true` when remaining vault routes (list/redeem) are ready. */
export const VAULT_PUBLIC_ENABLED = false;

export const VAULT_COMING_SOON_MESSAGE =
  "This Sell feature is coming soon. It is not available yet.";

/** Sell hub destination after `/sell` router (collector path). */
export const SELL_COLLECTOR_HUB_PATH = "/vault";

export function isVaultPublicPath(path: string): boolean {
  const base = path.split(/[?#]/)[0] ?? path;
  return base === "/vault" || base.startsWith("/vault/");
}

/** Sell dashboard hub — open while deeper vault routes stay gated. */
export function isVaultHubPath(path: string): boolean {
  const base = path.split(/[?#]/)[0] ?? path;
  return base === "/vault";
}

/** Mint submit flow — open for cert testing while other vault routes stay gated. */
export function isVaultMintSubmitPath(path: string): boolean {
  const base = path.split(/[?#]/)[0] ?? path;
  return (
    base === "/vault/submit/mint" ||
    base === "/vault/submit" ||
    base.startsWith("/vault/submit/")
  );
}

/** Submission detail (Vault-Detail.html A~H). */
export function isVaultSubmissionDetailPath(path: string): boolean {
  const base = path.split(/[?#]/)[0] ?? path;
  return base.startsWith("/vault/submissions/");
}

export function isVaultPathAccessible(path: string): boolean {
  return (
    VAULT_PUBLIC_ENABLED ||
    isVaultHubPath(path) ||
    isVaultMintSubmitPath(path) ||
    isVaultSubmissionDetailPath(path)
  );
}

/** Primary nav Sell is active on `/sell` and collector sell hub (`/vault*`). */
export function isSellPrimaryNavActive(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  let pathOnly = pathname;
  const qIdx = pathOnly.indexOf("?");
  if (qIdx >= 0) pathOnly = pathOnly.slice(0, qIdx);
  const hIdx = pathOnly.indexOf("#");
  if (hIdx >= 0) pathOnly = pathOnly.slice(0, hIdx);
  if (pathOnly === "/sell" || pathOnly.startsWith("/sell/")) return true;
  return pathOnly === "/vault" || pathOnly.startsWith("/vault/");
}

/**
 * Prototype Sell.html role branch. Partner add-cards ships in Phase 8;
 * until then approved partners land on the collector sell hub.
 */
export function resolveSellRouterDestination(): string {
  if (typeof window === "undefined") return SELL_COLLECTOR_HUB_PATH;
  try {
    const role = window.localStorage.getItem("tk_role") || "user";
    const partnerOk = window.localStorage.getItem("tk_partner_status") === "approved";
    if (role === "partner" && partnerOk) {
      // Phase 8: return "/partner/add-cards";
      return SELL_COLLECTOR_HUB_PATH;
    }
  } catch {
    /* ignore storage errors */
  }
  return SELL_COLLECTOR_HUB_PATH;
}

export function notifyVaultComingSoon(): void {
  if (typeof window !== "undefined") {
    window.alert(VAULT_COMING_SOON_MESSAGE);
  }
}
