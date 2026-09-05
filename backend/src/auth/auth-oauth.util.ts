/**
 * Auth paths that must stay reachable without the site-access gate cookie.
 * OAuth redirects can drop `site_access`; login must still complete.
 */
export function isAuthPublicApiPath(path: string, method: string): boolean {
  const m = method.toUpperCase();
  if (path === '/api/auth/session' && m === 'GET') return true;
  if (path === '/api/auth/privy/session' && m === 'POST') return true;
  if (path === '/api/auth/logout' && m === 'POST') return true;
  return false;
}
