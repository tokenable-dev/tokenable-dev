import type { ConfigService } from '@nestjs/config';
import type { TtlCacheProvider } from '../../common/cache/ttl-cache.interface';
import type { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import { CardhedgerCertLookupService } from './cardhedger-cert-lookup.service';
import { CardhedgerResolveService } from './cardhedger-resolve.service';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';

describe('CardhedgerResolveService — card-match-first (Phase 6)', () => {
  const ttlCache: TtlCacheProvider = {
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
    clearNamespace: () => undefined,
  };

  const searchHeavyCol = {
    collectionKey: 'pikachu-base-58',
    displayLabel: 'Pikachu Base Set #58',
    queryUsed: null,
    components: {
      cardName: 'Pikachu',
      cardSet: 'Base Set',
      cardNumber: '58',
    },
    coverImageUrl: null,
    psaCertNumber: null,
    marketParallelKey: 'base',
    bucketKeyVersion: 2,
    reviewStatus: 'active',
    createdAt: new Date(),
  } satisfies MarketplaceCollection;

  const cardMatchBody = {
    match: {
      card_id: 'match-card-id',
      confidence: 0.85,
      description: 'Pikachu Base Set',
      name: 'Pikachu',
      set: 'Base Set',
      number: '58',
      variant: 'Base',
      prices: [],
    },
  };

  const cardSearchBody = {
    cards: [
      {
        card_id: 'search-card-id',
        description: 'Pikachu Base Set',
        name: 'Pikachu',
        set: 'Base Set',
        number: '58',
        variant: 'Base',
      },
    ],
  };

  function serviceWithMocks(
    forwardJson: jest.Mock,
    cardMatchFirst: boolean,
    metrics?: CardhedgerMetricsService,
  ): CardhedgerResolveService {
    const cardhedger = {
      assertConfigured: () => undefined,
      forwardJson,
    } as unknown as CardhedgerService;
    const config = {
      get: (key: string) => {
        if (key === 'marketplace.cardhedgerFeatureFlags') {
          return {
            fmvBatchEnabled: false,
            batchPricesByCertEnabled: false,
            batchPriceEstimateEnabled: false,
            pricesByCertOcrEnabled: false,
            cardMatchFirst,
            mintPreviewSkipComps: false,
            certPricePilotCompare: false,
          };
        }
        if (key === 'marketplace.cardhedgerResolveMatchFirstPilotLog') {
          return false;
        }
        if (key === 'CARDHEDGER_MAX_SEARCH_CANDIDATES') return '4';
        return undefined;
      },
    } as unknown as ConfigService;
    const certLookup = {
      getCardRowByCert: jest.fn(),
    } as unknown as CardhedgerCertLookupService;
    return new CardhedgerResolveService(
      cardhedger,
      config,
      certLookup,
      ttlCache,
      metrics,
    );
  }

  it('tries card-match once before card-search when flag is on', async () => {
    const forwardJson = jest.fn(async (_method, path) => {
      if (path === '/v1/cards/card-match') return cardMatchBody;
      if (path === '/v1/cards/card-search') return cardSearchBody;
      return {};
    });
    const recordResolvePath = jest.fn();
    const recordResolvePath2Pilot = jest.fn();
    const metrics = {
      recordResolvePath,
      recordResolvePath2Pilot,
    } as unknown as CardhedgerMetricsService;

    const svc = serviceWithMocks(forwardJson, true, metrics);
    const result = await svc.resolveCardForCollection(searchHeavyCol);

    expect(forwardJson).toHaveBeenCalledTimes(1);
    expect(forwardJson).toHaveBeenCalledWith(
      'POST',
      '/v1/cards/card-match',
      expect.any(Object),
    );
    expect(result.row?.card_id).toBe('match-card-id');
    expect(recordResolvePath).toHaveBeenCalledWith('card_match_first');
    expect(recordResolvePath2Pilot).toHaveBeenCalledWith(
      expect.objectContaining({
        cardMatchFirstEnabled: true,
        success: true,
      }),
    );
  });

  it('falls back to card-search when card-match-first fails', async () => {
    const forwardJson = jest.fn(async (_method, path) => {
      if (path === '/v1/cards/card-match') return { match: null };
      if (path === '/v1/cards/card-search') return cardSearchBody;
      return {};
    });
    const recordResolvePath = jest.fn();
    const svc = serviceWithMocks(
      forwardJson,
      true,
      { recordResolvePath, recordResolvePath2Pilot: jest.fn() } as unknown as CardhedgerMetricsService,
    );

    const result = await svc.resolveCardForCollection(searchHeavyCol);

    expect(forwardJson.mock.calls.map((c) => c[1])).toEqual([
      '/v1/cards/card-match',
      '/v1/cards/card-search',
    ]);
    expect(result.row?.card_id).toBe('search-card-id');
    expect(recordResolvePath).toHaveBeenCalledWith('search', 1);
  });

  it('uses search-first then card-match last resort when flag is off', async () => {
    const forwardJson = jest.fn(async (_method, path) => {
      if (path === '/v1/cards/card-search') return { cards: [] };
      if (path === '/v1/cards/card-match') return cardMatchBody;
      return {};
    });
    const recordResolvePath = jest.fn();
    const svc = serviceWithMocks(
      forwardJson,
      false,
      { recordResolvePath, recordResolvePath2Pilot: jest.fn() } as unknown as CardhedgerMetricsService,
    );

    const result = await svc.resolveCardForCollection(searchHeavyCol);

    const paths = forwardJson.mock.calls.map((c) => c[1]);
    expect(paths.indexOf('/v1/cards/card-search')).toBeLessThan(
      paths.indexOf('/v1/cards/card-match'),
    );
    expect(result.row?.card_id).toBe('match-card-id');
    expect(recordResolvePath).toHaveBeenCalledWith('card_match');
    expect(recordResolvePath).not.toHaveBeenCalledWith('card_match_first');
  });
});
