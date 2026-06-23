import {
  isAuthPublicApiPath,
  resolveGoogleCallbackUrl,
} from './auth-oauth.util';

describe('auth-oauth.util', () => {
  it('derives callback from FRONTEND_URL when GOOGLE_CALLBACK_URL is unset', () => {
    expect(
      resolveGoogleCallbackUrl({
        FRONTEND_URL: 'http://localhost:3000',
      }),
    ).toBe('http://localhost:3000/api/auth/google/callback');
  });

  it('prefers explicit GOOGLE_CALLBACK_URL', () => {
    expect(
      resolveGoogleCallbackUrl({
        FRONTEND_URL: 'http://localhost:3000',
        GOOGLE_CALLBACK_URL: 'http://localhost:4000/api/auth/google/callback',
      }),
    ).toBe('http://localhost:4000/api/auth/google/callback');
  });

  it('whitelists Google OAuth paths for site-access bypass', () => {
    expect(isAuthPublicApiPath('/api/auth/google', 'GET')).toBe(true);
    expect(isAuthPublicApiPath('/api/auth/google/callback', 'GET')).toBe(true);
    expect(isAuthPublicApiPath('/api/auth/google/callback', 'POST')).toBe(false);
    expect(isAuthPublicApiPath('/api/auth/register', 'POST')).toBe(true);
    expect(isAuthPublicApiPath('/api/auth/login', 'POST')).toBe(true);
    expect(isAuthPublicApiPath('/api/auth/resend-verification-email', 'POST')).toBe(
      true,
    );
  });
});
