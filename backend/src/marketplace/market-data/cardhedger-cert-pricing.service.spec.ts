import { CardhedgerCertPricingService } from './cardhedger-cert-pricing.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import type { TtlCacheProvider } from '../../common/cache/ttl-cache.interface';

describe('CardhedgerCertPricingService', () => {
  const ttlCache: TtlCacheProvider = {
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
    clearNamespace: () => undefined,
  };

  function serviceWithForward(
    forwardJson: jest.Mock,
  ): CardhedgerCertPricingService {
    const cardhedger = {
      assertConfigured: () => undefined,
      forwardJson,
    } as unknown as CardhedgerService;
    const svc = new CardhedgerCertPricingService(cardhedger, ttlCache);
    jest
      .spyOn(svc as unknown as { isConfigured: () => boolean }, 'isConfigured')
      .mockReturnValue(true);
    return svc;
  }

  it('fetchPricesByCertsBatch maps cert digits to parsed price rows', async () => {
    const forwardJson = jest.fn(async () => ({
      results: [
        {
          cert_info: { cert: '76676185', grade: 'PSA 10' },
          card: { card_id: 'abc', description: 'Card' },
          price: 99,
          confidence: 0.8,
          method: 'direct',
        },
      ],
    }));
    const svc = serviceWithForward(forwardJson);
    const map = await svc.fetchPricesByCertsBatch(['76676185']);
    expect(forwardJson).toHaveBeenCalledWith(
      'POST',
      '/v1/cards/batch-prices-by-cert',
      expect.objectContaining({
        body: { certs: ['76676185'], grader: 'PSA' },
      }),
    );
    const row = map.get('76676185');
    expect(row?.price).toBe(99);
    expect(row?.card?.card_id).toBe('abc');
  });

  it('fetchPriceEstimatesBatch uses batch-price-estimate upstream', async () => {
    const forwardJson = jest.fn(async () => ({
      results: [
        {
          card_id: 'abc',
          grade: 'PSA 10',
          price: 55,
          method: 'correlated',
          confidence: 0.6,
        },
      ],
    }));
    const svc = serviceWithForward(forwardJson);
    const map = await svc.fetchPriceEstimatesBatch([
      { card_id: 'abc', grade: 'PSA 10' },
    ]);
    expect(forwardJson).toHaveBeenCalledWith(
      'POST',
      '/v1/cards/batch-price-estimate',
      expect.any(Object),
    );
    expect(map.get('abc:psa 10')?.price).toBe(55);
  });
});
