import {
  issueSiteAccessToken,
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
});
