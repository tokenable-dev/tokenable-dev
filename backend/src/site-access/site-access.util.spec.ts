import {
  isSiteAccessRequired,
  issueSiteAccessToken,
  readSiteAccessConfig,
  verifySiteAccessToken,
} from './site-access.util';

describe('site-access.util', () => {
  const secret = 'test-secret-min-16-chars';

  it('issues a token that verifies until expiry', () => {
    const token = issueSiteAccessToken(secret, 3600);
    expect(verifySiteAccessToken(token, secret)).toBe(true);
  });

  it('rejects tampered signature', () => {
    const token = issueSiteAccessToken(secret, 3600);
    const [exp] = token.split('.');
    expect(verifySiteAccessToken(`${exp}.deadbeef`, secret)).toBe(false);
  });

  it('rejects wrong secret', () => {
    const token = issueSiteAccessToken(secret, 3600);
    expect(verifySiteAccessToken(token, 'other-secret-min-16-ch')).toBe(false);
  });

  it('requires the gate on app + staging hosts even when the env flag is off', () => {
    const cfg = readSiteAccessConfig({ SITE_ACCESS_ENABLED: 'false' });
    expect(cfg.enabled).toBe(false);
    expect(cfg.password).toBe('717171');
    expect(isSiteAccessRequired(cfg, 'app.tokenable.io')).toBe(true);
    expect(isSiteAccessRequired(cfg, 'app.tokenable.io:443')).toBe(true);
    expect(isSiteAccessRequired(cfg, 'tokenable-dev.com')).toBe(true);
    expect(isSiteAccessRequired(cfg, 'www.tokenable-dev.com')).toBe(true);
    expect(isSiteAccessRequired(cfg, 'localhost:3000')).toBe(false);
  });

  it('requires the gate on every host when the env flag is on', () => {
    const cfg = readSiteAccessConfig({ SITE_ACCESS_ENABLED: 'true' });
    expect(isSiteAccessRequired(cfg, 'localhost:3000')).toBe(true);
    expect(isSiteAccessRequired(cfg, 'tokenable-dev.com')).toBe(true);
    expect(isSiteAccessRequired(cfg, 'app.tokenable.io')).toBe(true);
  });
});
