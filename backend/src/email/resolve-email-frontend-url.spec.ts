import type { ConfigService } from '@nestjs/config';
import {
  DEFAULT_TRANSACTIONAL_EMAIL_FRONTEND_URL,
  resolveEmailFrontendUrl,
} from './resolve-email-frontend-url';

function mockConfig(values: Record<string, string | boolean | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('resolveEmailFrontendUrl', () => {
  it('prefers TRANSACTIONAL_EMAIL_FRONTEND_URL', () => {
    const url = resolveEmailFrontendUrl(
      mockConfig({
        TRANSACTIONAL_EMAIL_FRONTEND_URL: 'https://staging.tokenable.io/',
        FRONTEND_URL: 'http://localhost:3000',
      }),
    );
    expect(url).toBe('https://staging.tokenable.io');
  });

  it('uses FRONTEND_URL in development', () => {
    const url = resolveEmailFrontendUrl(
      mockConfig({
        NODE_ENV: 'development',
        FRONTEND_URL: 'http://localhost:3000',
      }),
    );
    expect(url).toBe('http://localhost:3000');
  });

  it('defaults to app.tokenable.io in production when FRONTEND_URL is localhost', () => {
    const url = resolveEmailFrontendUrl(
      mockConfig({
        NODE_ENV: 'production',
        FRONTEND_URL: 'http://localhost:3000',
      }),
    );
    expect(url).toBe(DEFAULT_TRANSACTIONAL_EMAIL_FRONTEND_URL);
  });

  it('uses production FRONTEND_URL when it is a public https origin', () => {
    const url = resolveEmailFrontendUrl(
      mockConfig({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.tokenable.io',
      }),
    );
    expect(url).toBe('https://app.tokenable.io');
  });
});
