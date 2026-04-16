import type { MarketplaceCollection } from '../marketplace/entities/marketplace-collection.entity';
import { buildPoketraceSearchQueryAttempts } from './poketrace.service';

describe('buildPoketraceSearchQueryAttempts', () => {
  it('includes simpler fallbacks after a long JustTCG-style query (JP VMAX Climax style)', () => {
    const col = {
      collectionKey: 'test_bucket',
      displayLabel: 'FA Pikachu VMAX …',
      queryUsed:
        'FA Pikachu VMAX pokemon japanese sword & shield vmax climax 046',
      components: {
        cardName: 'fa/pikachu vmax',
        cardSet: 'pokemon japanese sword & shield vmax climax',
        cardNumber: '046',
      },
      coverImageUrl: null,
      createdAt: new Date(),
    } as MarketplaceCollection;

    const attempts = buildPoketraceSearchQueryAttempts(col);

    expect(attempts.length).toBeGreaterThanOrEqual(2);
    expect(attempts[0]).not.toContain('&');
    expect(
      attempts.some(
        (q) =>
          q.toLowerCase().includes('pikachu') &&
          q.includes('046') &&
          q.length < attempts[0].length,
      ),
    ).toBe(true);
  });
});
