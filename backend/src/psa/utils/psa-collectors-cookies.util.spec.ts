import {
  collectorsAuthNeedsRefresh,
  findDsrToken,
  jwtExpiresAtMs,
  preparePsaCollectorsCookies,
} from './psa-collectors-cookies.util';

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
});
