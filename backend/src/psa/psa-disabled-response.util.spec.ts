import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { throwPsaPublicApiDisabledException } from './psa-disabled-response.util';
import { PSA_RATE_LIMIT_CODE } from './psa-rate-limit.exception';

describe('throwPsaPublicApiDisabledException', () => {
  it('maps no_token to 503', () => {
    expect(() => throwPsaPublicApiDisabledException('no_token')).toThrow(
      ServiceUnavailableException,
    );
    try {
      throwPsaPublicApiDisabledException('no_token');
    } catch (err) {
      const ex = err as ServiceUnavailableException;
      expect(ex.getStatus()).toBe(503);
      expect(String(ex.message)).toMatch(/PSA_PUBLIC_API_TOKEN/);
    }
  });

  it('maps upstream_disabled to 503', () => {
    try {
      throwPsaPublicApiDisabledException('upstream_disabled');
    } catch (err) {
      const ex = err as ServiceUnavailableException;
      expect(ex.getStatus()).toBe(503);
      expect(String(ex.message)).toMatch(/upstream is disabled/);
    }
  });

  it('maps all_tokens_rate_limited to 429 with PSA_RATE_LIMIT code', () => {
    try {
      throwPsaPublicApiDisabledException('all_tokens_rate_limited');
    } catch (err) {
      const ex = err as HttpException;
      expect(ex.getStatus()).toBe(429);
      const body = ex.getResponse() as Record<string, unknown>;
      expect(body.code).toBe(PSA_RATE_LIMIT_CODE);
      expect(String(body.detail)).toMatch(/All PSA Public API tokens/);
    }
  });
});
