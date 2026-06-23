/**
 * OAuth redirect URI must match the browser origin (Next `/api` proxy), not the Nest listen port.
 * Dev Nest defaults to 4100 while `GOOGLE_CALLBACK_URL` in old envs often wrongly used :4000.
 */
export function resolveGoogleCallbackUrl(env: NodeJS.ProcessEnv): string {
  const explicit = env.GOOGLE_CALLBACK_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const front = env.FRONTEND_URL?.trim().replace(/\/$/, '');
  if (!front) {
    throw new Error(
      'Set GOOGLE_CALLBACK_URL or FRONTEND_URL for Google OAuth (e.g. http://localhost:3000/api/auth/google/callback)',
    );
  }
  return `${front}/api/auth/google/callback`;
}

export function frontendBaseUrl(env: NodeJS.ProcessEnv): string {
  const front = env.FRONTEND_URL?.trim().replace(/\/$/, '');
  if (!front) {
    throw new Error('FRONTEND_URL is required');
  }
  return front;
}

/** Paths that must stay reachable without the site-access gate cookie (OAuth redirects, email links). */
export function isAuthPublicApiPath(path: string, method: string): boolean {
  const m = method.toUpperCase();
  if (m === 'GET') {
    return (
      path === '/api/auth/google' ||
      path === '/api/auth/google/callback' ||
      path === '/api/auth/verify-email'
    );
  }
  if (m === 'POST') {
    return (
      path === '/api/auth/register' ||
      path === '/api/auth/login' ||
      path === '/api/auth/resend-verification-email' ||
      path === '/api/auth/forgot-password' ||
      path === '/api/auth/reset-password'
    );
  }
  return false;
}
