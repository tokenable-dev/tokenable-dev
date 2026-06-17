import {
  collectorsAuthNeedsRefresh,
  cookiesFromRefreshTokenOnly,
  findDsrToken,
  jwtExpiresAtMs,
  loadPsaCollectorsCookies,
  preparePsaCollectorsCookies,
  resolvePsaCollectorsSessionCookies,
} from './psa-collectors-cookies.util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('psa-collectors-cookies.util', () => {
  it('drops expired cf_clearance and keeps auth cookies', () => {
    const nowMs = 1_780_000_000_000;
    const { cookies, warnings } = preparePsaCollectorsCookies(
      [
        {
          name: 'DSR',
          value: 'token',
          domain: '.collectors.com',
          path: '/',
        },
        {
          name: 'refreshToken',
          value: 'refresh',
          domain: 'www.psacard.com',
          path: '/',
        },
        {
          name: 'cf_clearance',
          value: 'stale',
          domain: '.psacard.com',
          path: '/',
          expires: 1_700_000_000,
        },
      ],
      { nowMs },
    );

    expect(cookies.some((c) => c.name === 'cf_clearance')).toBe(false);
    expect(cookies.some((c) => c.name === 'DSR' && c.domain === '.psacard.com')).toBe(
      true,
    );
    expect(warnings.some((w) => w.includes('cf_clearance'))).toBe(true);
  });

  it('detects when DSR is near expiry', () => {
    const exp = Math.floor((Date.now() + 60_000) / 1000);
    const dsr = `h.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.s`;
    const cookies = preparePsaCollectorsCookies([
      { name: 'DSR', value: dsr, domain: '.psacard.com', path: '/' },
      { name: 'refreshToken', value: 'rt', domain: '.psacard.com', path: '/' },
    ]).cookies;
    expect(collectorsAuthNeedsRefresh(cookies, 172_800_000)).toBe(true);
    expect(findDsrToken(cookies)).toBe(dsr);
    expect(jwtExpiresAtMs(dsr)).toBe(exp * 1000);
  });

  it('loadPsaCollectorsCookies returns [] when file is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'psa-cookies-'));
    try {
      const rows = await loadPsaCollectorsCookies({
        cookiesFile: 'missing.json',
        cwd: dir,
      });
      expect(rows).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('resolvePsaCollectorsSessionCookies falls back to refresh token when file missing', async () => {
    const cookies = await resolvePsaCollectorsSessionCookies({
      cookiesFile: '/no/such/path/cookies.json',
      refreshToken: 'rt.jwt.value',
    });
    expect(cookies.some((c) => c.name === 'refreshToken' && c.value === 'rt.jwt.value')).toBe(
      true,
    );
  });

  it('resolvePsaCollectorsSessionCookies prefers env refresh token over file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'psa-cookies-'));
    const file = 'cookies.json';
    try {
      const cookies = await resolvePsaCollectorsSessionCookies({
        cookiesFile: file,
        refreshToken: 'env.refresh.token',
        cwd: dir,
      });
      expect(cookies.some((c) => c.name === 'refreshToken' && c.value === 'env.refresh.token')).toBe(
        true,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
