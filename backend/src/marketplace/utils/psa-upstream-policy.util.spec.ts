import { ConfigService } from '@nestjs/config';
import {
  isPsaPublicApiBackgroundUpstreamEnabled,
  isPsaPublicApiMintUpstreamEnabled,
  isPsaPublicApiSnapshotUpstreamEnabled,
  isPsaPublicApiUpstreamEnabled,
} from './psa-upstream-policy.util';
import { psaPublicApiAllowedForSnapshotReason } from './psa-components-mirror.util';

describe('psa upstream policy', () => {
  const config = {
    get: (key: string) =>
      ({
        PSA_PUBLIC_API_BACKGROUND_UPSTREAM: 'true',
        PSA_PUBLIC_API_ON_MINT: 'true',
        PSA_PUBLIC_API_REFRESH_ON_SNAPSHOT: 'always',
      })[key],
  } as ConfigService;

  it('blocks mint upstream even when env flags are set', () => {
    expect(isPsaPublicApiMintUpstreamEnabled(config)).toBe(false);
  });

  it('blocks snapshot upstream even when env flags are set', () => {
    expect(
      isPsaPublicApiSnapshotUpstreamEnabled(
        config,
        config.get('PSA_PUBLIC_API_REFRESH_ON_SNAPSHOT'),
      ),
    ).toBe(false);
  });

  it('blocks snapshot reason policy', () => {
    expect(
      psaPublicApiAllowedForSnapshotReason('cold_start', 'always'),
    ).toBe(false);
  });

  it('allows background only when PSA_PUBLIC_API_BACKGROUND_UPSTREAM is set', () => {
    expect(isPsaPublicApiBackgroundUpstreamEnabled(config)).toBe(true);
  });

  it('defaults background upstream to off', () => {
    const off = { get: () => undefined } as unknown as ConfigService;
    expect(isPsaPublicApiBackgroundUpstreamEnabled(off)).toBe(false);
  });

  it('defaults PSA Public API upstream to off', () => {
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
  });

  it('enables PSA Public API upstream when env is true', () => {
    const on = {
      get: (key: string) =>
        key === 'PSA_PUBLIC_API_UPSTREAM_ENABLED' ? 'true' : undefined,
    } as unknown as ConfigService;
    expect(isPsaPublicApiUpstreamEnabled(on)).toBe(true);
  });
});
