import { isAuthPublicApiPath } from './auth-oauth.util';

describe('isAuthPublicApiPath', () => {
  it('allows Tokenable session endpoints through the site-access gate', () => {
    expect(isAuthPublicApiPath('/api/auth/session', 'GET')).toBe(true);
    expect(isAuthPublicApiPath('/api/auth/privy/session', 'POST')).toBe(true);
    expect(isAuthPublicApiPath('/api/auth/logout', 'POST')).toBe(true);
  });

  it('blocks legacy Google/email routes', () => {
    expect(isAuthPublicApiPath('/api/auth/google', 'GET')).toBe(false);
    expect(isAuthPublicApiPath('/api/auth/register', 'POST')).toBe(false);
  });
});
