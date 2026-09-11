import { ConfigService } from '@nestjs/config';
import {
  isPsaPublicApiMarketplaceUpstreamEnabled,
  isPsaPublicApiMintUpstreamEnabled,
  isPsaPublicApiSnapshotUpstreamEnabled,
  isPsaPublicApiUpstreamEnabled,
} from './psa-upstream-policy.util';
import { psaPublicApiAllowedForSnapshotReason } from './psa-components-mirror.util';

describe('psa upstream policy — mint-only', () => {
  const config = {
    get: (key: string) =>
      ({
        PSA_PUBLIC_API_REFRESH_ON_SNAPSHOT: 'always',
        PSA_PUBLIC_API_TOKEN: 'abc123',
        PSA_PUBLIC_API_UPSTREAM_ENABLED: 'true',
      })[key],
  } as ConfigService;

  it('allows mint upstream when master switch / token is on', () => {
    expect(isPsaPublicApiMintUpstreamEnabled(config)).toBe(true);
    expect(isPsaPublicApiUpstreamEnabled(config)).toBe(true);
  });

  it('hard-blocks marketplace upstream', () => {
    expect(isPsaPublicApiMarketplaceUpstreamEnabled()).toBe(false);
  });

  it('hard-blocks snapshot upstream even when refresh env is always', () => {
    expect(
      isPsaPublicApiSnapshotUpstreamEnabled(
        config,
        config.get('PSA_PUBLIC_API_REFRESH_ON_SNAPSHOT'),
      ),
    ).toBe(false);
    expect(
      psaPublicApiAllowedForSnapshotReason('cold_start', 'always'),
    ).toBe(false);
  });

  it('defaults PSA Public API upstream to off without token', () => {
    const off = { get: () => undefined } as unknown as ConfigService;
    expect(isPsaPublicApiUpstreamEnabled(off)).toBe(false);
  });

  it('defaults PSA Public API upstream on when token is set', () => {
    const withToken = {
      get: (key: string) =>
        key === 'PSA_PUBLIC_API_TOKEN' ? 'abc123' : undefined,
    } as unknown as ConfigService;
    expect(isPsaPublicApiUpstreamEnabled(withToken)).toBe(true);
  });

  it('respects explicit PSA_PUBLIC_API_UPSTREAM_ENABLED=false', () => {
    const off = {
      get: (key: string) =>
        key === 'PSA_PUBLIC_API_UPSTREAM_ENABLED'
          ? 'false'
          : key === 'PSA_PUBLIC_API_TOKEN'
            ? 'abc123'
            : undefined,
    } as unknown as ConfigService;
    expect(isPsaPublicApiUpstreamEnabled(off)).toBe(false);
    expect(isPsaPublicApiMintUpstreamEnabled(off)).toBe(false);
  });
});
