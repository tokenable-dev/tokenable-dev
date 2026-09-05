import {
  parsePositiveIntEnv,
  psaRateLimitCooldownMs,
} from './psa-public-api-rate-limit.util';

describe('psa-public-api-rate-limit.util', () => {
  it('uses Retry-After seconds when present', () => {
    expect(psaRateLimitCooldownMs('120', 60_000)).toBe(120_000);
  });

  it('falls back to default cooldown when Retry-After missing', () => {
    expect(psaRateLimitCooldownMs(null, 45_000)).toBe(45_000);
  });

  it('caps in-process cooldown when PSA Retry-After is ~24h daily quota', () => {
    expect(psaRateLimitCooldownMs('86251', 60_000, 60_000)).toBe(60_000);
  });

  it('parses max cert attempts with cap', () => {
    expect(parsePositiveIntEnv('5', 3, 10)).toBe(5);
    expect(parsePositiveIntEnv('99', 3, 10)).toBe(10);
    expect(parsePositiveIntEnv(undefined, 3, 10)).toBe(3);
  });
});
