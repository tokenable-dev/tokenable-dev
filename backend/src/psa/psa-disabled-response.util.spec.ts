import { ServiceUnavailableException } from '@nestjs/common';
import { throwPsaPublicApiDisabledException } from './psa-disabled-response.util';

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
});
