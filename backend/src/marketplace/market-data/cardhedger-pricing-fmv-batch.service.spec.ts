import { ConfigService } from '@nestjs/config';
import { CardhedgerPricingService } from './cardhedger-pricing.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import { CardhedgerResolveService } from './cardhedger-resolve.service';
import { cardhedgerFmvMapKey } from './cardhedger-fmv.util';
import type { TtlCacheProvider } from '../../common/cache/ttl-cache.interface';

describe('CardhedgerPricingService.fetchFmvBatch', () => {
  const ttlCache: TtlCacheProvider = {
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
    clearNamespace: () => undefined,
  };

  const config = {
    get: (key: string) => {
      if (key === 'CARDHEDGER_MIN_RELIABLE_SALES_30D') return '5';
      if (key === 'CARDHEDGER_MIN_VERIFIED_SALES_30D') return '1';
      return undefined;
    },
  } as unknown as ConfigService;

  const resolve = {} as CardhedgerResolveService;

  function serviceWithForward(
    forwardJson: jest.Mock,
  ): CardhedgerPricingService {
    const cardhedger = {
      assertConfigured: () => undefined,
      forwardJson,
    } as unknown as CardhedgerService;
    const pricing = new CardhedgerPricingService(
      cardhedger,
      config,
      ttlCache,
      resolve,
    );
    jest.spyOn(pricing as unknown as { isConfigured: () => boolean }, 'isConfigured').mockReturnValue(true);
    return pricing;
  }

  it('chunks requests at 100 items and preserves order in map keys', async () => {
    const forwardJson = jest.fn(async (_method: string, path: string, opts: { body: { items: Array<{ card_id: string; grade: string }> } }) => {
      expect(path).toBe('/v1/cards/card-fmv-batch');
      return {
        results: opts.body.items.map((it, i) => ({
          card_id: it.card_id,
          grade: it.grade,
          price: 10 + i,
          confidence_grade: 'B',
          method: 'direct',
        })),
        total_requested: opts.body.items.length,
        total_successful: opts.body.items.length,
      };
    });

    const pricing = serviceWithForward(forwardJson);
    const items = Array.from({ length: 105 }, (_, i) => ({
      card_id: `card_${i}`,
      grade: 'PSA 10',
    }));

    const map = await pricing.fetchFmvBatch(items);
    expect(forwardJson).toHaveBeenCalledTimes(2);
    expect(map.size).toBe(105);
    expect(map.get(cardhedgerFmvMapKey('card_0', 'PSA 10'))?.price).toBe(10);
    expect(map.get(cardhedgerFmvMapKey('card_104', 'PSA 10'))?.price).toBe(14);
  });

  it('dedupes identical card_id+grade before upstream call', async () => {
    const forwardJson = jest.fn(async () => ({
      results: [
        {
          card_id: 'dup',
          grade: 'PSA 10',
          price: 99,
          method: 'direct',
          confidence_grade: 'A',
        },
      ],
      total_requested: 1,
      total_successful: 1,
    }));

    const pricing = serviceWithForward(forwardJson);
    const map = await pricing.fetchFmvBatch([
      { card_id: 'dup', grade: 'PSA 10' },
      { card_id: 'dup', grade: 'PSA 10' },
    ]);
    expect(forwardJson).toHaveBeenCalledTimes(1);
    expect(map.get(cardhedgerFmvMapKey('dup', 'PSA 10'))?.price).toBe(99);
  });
});
