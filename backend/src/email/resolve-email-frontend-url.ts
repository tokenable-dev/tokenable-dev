import type { ConfigService } from '@nestjs/config';

/** Public app origin for links in transactional email (not cookie redirects). */
export const DEFAULT_TRANSACTIONAL_EMAIL_FRONTEND_URL =
  'https://app.tokenable.io';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function isLocalOrLoopbackOrigin(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  } catch {
    return false;
  }
}

/**
 * Email links must point at the public app (e.g. app.tokenable.io), not
 * `FRONTEND_URL` when the API runs with localhost for cookies/CORS on the same host.
 */
export function resolveEmailFrontendUrl(config: ConfigService): string {
  const fromEmailEnv = config
    .get<string>('TRANSACTIONAL_EMAIL_FRONTEND_URL')
    ?.trim();
  if (fromEmailEnv) {
    return stripTrailingSlash(fromEmailEnv);
  }

  const fromFront = config.get<string>('FRONTEND_URL')?.trim() ?? '';
  const normalized = stripTrailingSlash(fromFront);

  const isProduction =
    config.get<boolean>('app.isProduction') === true ||
    config.get<string>('NODE_ENV') === 'production';

  if (
    isProduction &&
    (!normalized || isLocalOrLoopbackOrigin(normalized))
  ) {
    return DEFAULT_TRANSACTIONAL_EMAIL_FRONTEND_URL;
  }

  if (!normalized) {
    throw new Error('FRONTEND_URL is required for transactional email links');
  }

  return normalized;
}
