import { isAuthPublicApiPath } from './auth-oauth.util';

describe('isAuthPublicApiPath', () => {
  it('returns false — legacy Google/email routes were removed', () => {
    expect(isAuthPublicApiPath('/api/auth/google', 'GET')).toBe(false);
    expect(isAuthPublicApiPath('/api/auth/register', 'POST')).toBe(false);
    expect(isAuthPublicApiPath('/api/auth/privy/session', 'POST')).toBe(false);
    expect(isAuthPublicApiPath('/api/auth/session', 'GET')).toBe(false);
  });
});
