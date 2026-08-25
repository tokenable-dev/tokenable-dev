import { ConfigService } from '@nestjs/config';

type TokenCache = { token: string; expiresAtMs: number };

export type FedExOAuthProfile = 'rate' | 'track';

const tokenCaches: Partial<Record<FedExOAuthProfile, TokenCache>> = {};

export function fedExTruthy(config: ConfigService, key: string): boolean {
  const v = config.get<string>(key)?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function fedExBaseUrl(config: ConfigService): string {
  return (
    config.get<string>('FEDEX_API_BASE_URL')?.trim() ||
    'https://apis-sandbox.fedex.com'
  ).replace(/\/$/, '');
}

export function requireFedExOAuthCreds(
  config: ConfigService,
  profile: FedExOAuthProfile = 'rate',
): { clientId: string; clientSecret: string } {
  let clientId =
    config
      .get<string>(
        profile === 'track' ? 'FEDEX_TRACK_CLIENT_ID' : 'FEDEX_CLIENT_ID',
      )
      ?.trim() ?? '';
  let clientSecret =
    config
      .get<string>(
        profile === 'track'
          ? 'FEDEX_TRACK_CLIENT_SECRET'
          : 'FEDEX_CLIENT_SECRET',
      )
      ?.trim() ?? '';
  if (profile === 'track' && (!clientId || !clientSecret)) {
    clientId = config.get<string>('FEDEX_CLIENT_ID')?.trim() ?? '';
    clientSecret = config.get<string>('FEDEX_CLIENT_SECRET')?.trim() ?? '';
  }
  if (!clientId || !clientSecret) {
    const label =
      profile === 'track'
        ? 'FEDEX_TRACK_CLIENT_ID / FEDEX_TRACK_CLIENT_SECRET (or shared FEDEX_CLIENT_ID / SECRET)'
        : 'FEDEX_CLIENT_ID / FEDEX_CLIENT_SECRET';
    throw new Error(`${label} incomplete`);
  }
  return { clientId, clientSecret };
}

/** Optional — Rate API account number (Track API does not require it). */
export function fedExAccountNumber(config: ConfigService): string {
  return config.get<string>('FEDEX_ACCOUNT_NUMBER')?.trim() ?? '';
}

export type FedExOAuthStatus = {
  ok: boolean;
  expiresInSec?: number;
  error?: string;
};

/** Client-credentials OAuth — separate caches for Rate vs Track project keys. */
export async function fetchFedExAccessToken(
  config: ConfigService,
  profile: FedExOAuthProfile = 'rate',
): Promise<{ token: string; status: FedExOAuthStatus }> {
  const now = Date.now();
  const cached = tokenCaches[profile];
  if (cached && cached.expiresAtMs > now + 60_000) {
    return {
      token: cached.token,
      status: {
        ok: true,
        expiresInSec: Math.max(
          0,
          Math.round((cached.expiresAtMs - now) / 1000),
        ),
      },
    };
  }

  const { clientId, clientSecret } = requireFedExOAuthCreds(config, profile);
  const baseUrl = fedExBaseUrl(config);
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    errors?: Array<{ message?: string; code?: string }>;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    const msg =
      json.errors?.[0]?.message ||
      json.error_description ||
      `FedEx OAuth failed (${res.status})`;
    return { token: '', status: { ok: false, error: msg } };
  }
  const expiresInSec = Number(json.expires_in) || 3600;
  tokenCaches[profile] = {
    token: json.access_token,
    expiresAtMs: now + expiresInSec * 1000,
  };
  return {
    token: json.access_token,
    status: { ok: true, expiresInSec },
  };
}

/** Test helper — clears in-process OAuth cache between specs. */
export function resetFedExOAuthCacheForTests(): void {
  delete tokenCaches.rate;
  delete tokenCaches.track;
}

export type FedExApiCallResult = {
  httpStatus: number;
  body: unknown;
};

export async function postFedExJson(
  config: ConfigService,
  path: string,
  body: unknown,
  token: string,
): Promise<FedExApiCallResult> {
  const baseUrl = fedExBaseUrl(config);
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${baseUrl}${normalized}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-locale': 'en_US',
    },
    body: JSON.stringify(body),
  });
  return {
    httpStatus: res.status,
    body: await res.json().catch(() => ({})),
  };
}

export function fedExPublicConfig(config: ConfigService): {
  baseUrl: string;
  clientIdPrefix: string;
  rateClientIdPrefix: string;
  trackClientIdPrefix: string;
  accountNumberSuffix: string;
  rateEnabled: boolean;
  trackEnabled: boolean;
} {
  let rateClientIdPrefix = '';
  let trackClientIdPrefix = '';
  let accountNumberSuffix = '';
  try {
    const { clientId: rateId } = requireFedExOAuthCreds(config, 'rate');
    rateClientIdPrefix = rateId.slice(0, 8);
  } catch {
    /* incomplete rate creds */
  }
  try {
    const { clientId: trackId } = requireFedExOAuthCreds(config, 'track');
    trackClientIdPrefix = trackId.slice(0, 8);
  } catch {
    /* incomplete track creds */
  }
  const acct = fedExAccountNumber(config);
  accountNumberSuffix = acct ? acct.slice(-4) : '';
  return {
    baseUrl: fedExBaseUrl(config),
    clientIdPrefix: trackClientIdPrefix || rateClientIdPrefix,
    rateClientIdPrefix,
    trackClientIdPrefix,
    accountNumberSuffix,
    rateEnabled: fedExTruthy(config, 'FEDEX_RATE_ENABLED'),
    trackEnabled: fedExTruthy(config, 'FEDEX_TRACK_ENABLED'),
  };
}
