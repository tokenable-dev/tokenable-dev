/**
 * Auth paths that must stay reachable without the site-access gate cookie.
 * User-facing auth is Privy-only — no public Google/email/password routes remain.
 */
export function isAuthPublicApiPath(_path: string, _method: string): boolean {
  return false;
}
