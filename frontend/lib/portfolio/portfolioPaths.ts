export const PORTFOLIO_PATH = "/portfolio";
export const PARTNER_PORTFOLIO_PATH = "/partner/portfolio";

export function stripPathQueryHash(path: string): string {
  let pathOnly = path;
  const qIdx = pathOnly.indexOf("?");
  if (qIdx >= 0) pathOnly = pathOnly.slice(0, qIdx);
  const hIdx = pathOnly.indexOf("#");
  if (hIdx >= 0) pathOnly = pathOnly.slice(0, hIdx);
  return pathOnly;
}

export function isPortfolioRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const pathOnly = stripPathQueryHash(pathname);
  if (pathOnly === PORTFOLIO_PATH || pathOnly.startsWith(`${PORTFOLIO_PATH}/`)) {
    return true;
  }
  return (
    pathOnly === PARTNER_PORTFOLIO_PATH ||
    pathOnly.startsWith(`${PARTNER_PORTFOLIO_PATH}/`)
  );
}

export function isPartnerPortfolioRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const pathOnly = stripPathQueryHash(pathname);
  return (
    pathOnly === PARTNER_PORTFOLIO_PATH ||
    pathOnly.startsWith(`${PARTNER_PORTFOLIO_PATH}/`)
  );
}

export function portfolioBasePath(
  pathname: string | null | undefined,
): typeof PORTFOLIO_PATH | typeof PARTNER_PORTFOLIO_PATH {
  return isPartnerPortfolioRoute(pathname) ? PARTNER_PORTFOLIO_PATH : PORTFOLIO_PATH;
}

export function portfolioHrefForPartner(isPartner: boolean): string {
  return isPartner
    ? `${PARTNER_PORTFOLIO_PATH}?tab=assets`
    : `${PORTFOLIO_PATH}?tab=assets`;
}

/** Certificate of Ownership — PortfolioAsset.html */
export function portfolioAssetHref(base: string, tokenId: number): string {
  const id = Math.floor(Number(tokenId));
  return `${base}/assets/${id}`;
}

export function portfolioUrl(
  base: string,
  params?: URLSearchParams | string,
): string {
  if (!params) return base;
  const qs = typeof params === "string" ? params : params.toString();
  return qs ? `${base}?${qs}` : base;
}
