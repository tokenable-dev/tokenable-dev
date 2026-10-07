/**
 * P3.18 — L1 cache periodic sweep (memory safety).
 */

import { InProcessIdentityCacheProvider } from './identity-cache.provider';

describe('InProcessIdentityCacheProvider L1 sweep (P3.18)', () => {
  const config = { get: () => undefined } as never;

  it('sweepExpired removes only TTL-expired keys', async () => {
    const provider = new InProcessIdentityCacheProvider(config);
    await provider.set('live', 'card-a', 60_000);
    await provider.set('expired', 'card-b', 1);
    await new Promise((r) => setTimeout(r, 5));

    expect(provider.sweepExpired()).toBe(1);
    expect(await provider.get('live')).toBe('card-a');
    expect(await provider.get('expired')).toBeNull();
  });

  it('does not remove unexpired keys', async () => {
    const provider = new InProcessIdentityCacheProvider(config);
    await provider.set('k1', 'v1', 60_000);
    await provider.set('k2', 'v2', 60_000);

    expect(provider.sweepExpired()).toBe(0);
    expect(await provider.get('k1')).toBe('v1');
    expect(await provider.get('k2')).toBe('v2');
  });

  it('onModuleDestroy clears sweep timer without error', () => {
    const provider = new InProcessIdentityCacheProvider(config);
    provider.onModuleInit();
    expect(() => provider.onModuleDestroy()).not.toThrow();
  });
});
