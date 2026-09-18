import { mintedTokenIdRange } from './rwa-token-registry.service';

describe('mintedTokenIdRange', () => {
  it('matches TokenableRWA 1-based ids (totalMinted = newest token id)', () => {
    expect(mintedTokenIdRange(0)).toEqual([]);
    expect(mintedTokenIdRange(1)).toEqual([1]);
    expect(mintedTokenIdRange(22)).toEqual(
      Array.from({ length: 22 }, (_, i) => i + 1),
    );
    expect(mintedTokenIdRange(22)).toContain(22);
    expect(mintedTokenIdRange(22)).not.toContain(0);
  });
});
