import type { ConfigService } from '@nestjs/config';
import type { TtlCacheProvider } from '../../common/cache/ttl-cache.interface';
import type { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import { CardhedgerCertLookupService } from './cardhedger-cert-lookup.service';
import { CardhedgerResolveService } from './cardhedger-resolve.service';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';

const ttlCache: TtlCacheProvider = {
  get: () => undefined,
  set: () => undefined,
  delete: () => undefined,
  clearNamespace: () => undefined,
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

describe('CardhedgerResolveService — card-match-first (Phase 6)', () => {

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

  it('resolves Prizm Rookie Signatures via GemRate cert description search', async () => {
    const lonnieCol = {
      collectionKey: '528db854b74ebccbb75aa91d2b06b337522564b03a000e7618f55875a3696a99',
      displayLabel: 'LONNIE WALKER IV',
      queryUsed: null,
      components: {
        cardName: 'LONNIE WALKER IV',
        cardSet: 'PANINI PRIZM ROOKIE SIGNATURES',
        cardNumber: 'RSLW4',
        psaSubject: 'LONNIE WALKER IV',
        psaBrand: 'PANINI PRIZM ROOKIE SIGNATURES',
        psaVariety: 'ROOKIE SIGNATURES',
        psaYear: '2018',
        marketParallelKey: 'rookie_signatures',
        cardhedgerSearchQuery:
          '2018 Panini Prizm Rookie Signatures Lonnie Walker IV RSLW4',
      },
      coverImageUrl: null,
      psaCertNumber: '44457519',
      marketParallelKey: 'rookie_signatures',
      bucketKeyVersion: 2,
      reviewStatus: 'active',
      createdAt: new Date(),
    } satisfies MarketplaceCollection;

    const lonnieSearchBody = {
      cards: [
        {
          card_id: 'lonnie-sensational-id',
          description:
            'Lonnie Walker IV 2018 Panini Prizm Sensational Signatures Basketball',
          name: 'Lonnie Walker IV',
          set: '2018 Panini Prizm Basketball',
          number: '78',
          variant: 'Base',
        },
        {
          card_id: 'lonnie-rookie-sig-sparkle-id',
          description:
            'Lonnie Walker IV 2018 Panini Prizm Rookie Signatures Basketball White Sparkle',
          name: 'Lonnie Walker IV',
          set: '2018 Panini Prizm Basketball',
          number: '18',
          variant: 'White Sparkle',
        },
        {
          card_id: 'lonnie-rookie-sig-id',
          description:
            'Lonnie Walker IV 2018 Panini Prizm Rookie Signatures Basketball',
          name: 'Lonnie Walker IV',
          set: '2018 Panini Prizm Basketball',
          number: '18',
          variant: 'Base',
        },
      ],
    };

    const forwardJson = jest.fn(async (_method, path) => {
      if (path === '/v1/cards/card-search') return lonnieSearchBody;
      return {};
    });

    const certLookup = {
      getCardRowByCert: jest.fn(async () => ({
        row: null,
        certDescription:
          '2018 Panini Prizm Rookie Signatures Lonnie Walker IV RSLW4',
      })),
    } as unknown as CardhedgerCertLookupService;

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
            cardMatchFirst: false,
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

    const svc = new CardhedgerResolveService(
      cardhedger,
      config,
      certLookup,
      ttlCache,
      {
        recordResolvePath: jest.fn(),
        recordResolvePath2Pilot: jest.fn(),
      } as unknown as CardhedgerMetricsService,
    );

    const result = await svc.resolveCardForCollection(lonnieCol);

    expect(result.row?.card_id).toBe('lonnie-rookie-sig-id');
    expect(result.confidence).toBe('verified');
  });
});

describe('CardhedgerResolveService — PSA Variety vs Cardhedger catalog variant', () => {
  const gengarSearchBody = {
    cards: [
      {
        card_id: 'gengar-base-id',
        description: 'Pokemon Japanese 151 Gengar 094',
        name: 'Gengar',
        set: 'Pokemon Japanese 151',
        number: '094',
        variant: 'Base',
      },
      {
        card_id: '1694044201512x180824829158223720',
        description: 'Pokemon Japanese 151 Gengar Reverse Foil 094',
        name: 'Gengar',
        set: 'Pokemon Japanese 151',
        number: '094',
        variant: 'Reverse Foil',
      },
      {
        card_id: '1694044347157x258677420840309300',
        description: 'Pokemon Japanese 151 Gengar Master Ball 094',
        name: 'Gengar',
        set: 'Pokemon Japanese 151',
        number: '094',
        variant: 'Master Ball',
      },
    ],
  };

  function gengarCol(opts: {
    psaVariety: string;
    marketParallelKey: string;
    cardhedgerCardId?: string;
    psaCertNumber?: string | null;
  }): MarketplaceCollection {
    return {
      collectionKey: 'gengar-jp-151-094',
      displayLabel: 'GENGAR',
      queryUsed: null,
      components: {
        cardName: 'Gengar',
        cardSet: 'Pokemon Japanese 151',
        cardNumber: '094',
        psaSubject: 'GENGAR',
        psaBrand: 'POKEMON JAPANESE SV2a-POKEMON CARD 151',
        psaVariety: opts.psaVariety,
        marketParallelKey: opts.marketParallelKey,
        ...(opts.cardhedgerCardId
          ? { cardhedgerCardId: opts.cardhedgerCardId }
          : {}),
      },
      coverImageUrl: null,
      psaCertNumber: opts.psaCertNumber ?? null,
      marketParallelKey: opts.marketParallelKey,
      bucketKeyVersion: 2,
      reviewStatus: 'active',
      createdAt: new Date(),
    } satisfies MarketplaceCollection;
  }

  it('picks Reverse Foil for PSA REVERSE HOLO among Base / Reverse Foil / Master Ball', async () => {
    const forwardJson = jest.fn(async (_method, path) => {
      if (path === '/v1/cards/card-search') return gengarSearchBody;
      return {};
    });
    const svc = serviceWithMocks(forwardJson, false, {
      recordResolvePath: jest.fn(),
      recordResolvePath2Pilot: jest.fn(),
    } as unknown as CardhedgerMetricsService);

    const result = await svc.resolveCardForCollection(
      gengarCol({
        psaVariety: 'REVERSE HOLO',
        marketParallelKey: 'reverse_holo',
      }),
    );

    expect(result.row?.card_id).toBe('1694044201512x180824829158223720');
    expect(result.row?.variant).toBe('Reverse Foil');
  });

  it('picks Master Ball for PSA MASTER BALL REVERSE HOLO among Base / Reverse Foil / Master Ball', async () => {
    const forwardJson = jest.fn(async (_method, path) => {
      if (path === '/v1/cards/card-search') return gengarSearchBody;
      return {};
    });
    const svc = serviceWithMocks(forwardJson, false, {
      recordResolvePath: jest.fn(),
      recordResolvePath2Pilot: jest.fn(),
    } as unknown as CardhedgerMetricsService);

    const result = await svc.resolveCardForCollection(
      gengarCol({
        psaVariety: 'MASTER BALL REVERSE HOLO',
        marketParallelKey: 'master_ball_reverse_holo',
      }),
    );

    expect(result.row?.card_id).toBe('1694044347157x258677420840309300');
    expect(result.row?.variant).toBe('Master Ball');
  });

  it('rejects a stored Reverse Foil card_id and re-resolves via card-search to Master Ball', async () => {
    const forwardJson = jest.fn(async (_method, path) => {
      if (path === '/v1/cards/card-details') {
        return {
          cards: [gengarSearchBody.cards[1]],
        };
      }
      if (path === '/v1/cards/card-search') return gengarSearchBody;
      return {};
    });
    const svc = serviceWithMocks(forwardJson, false, {
      recordResolvePath: jest.fn(),
      recordResolvePath2Pilot: jest.fn(),
    } as unknown as CardhedgerMetricsService);

    const result = await svc.resolveCardForCollection(
      gengarCol({
        psaVariety: 'MASTER BALL REVERSE HOLO',
        marketParallelKey: 'master_ball_reverse_holo',
        cardhedgerCardId: '1694044201512x180824829158223720',
      }),
    );

    expect(forwardJson.mock.calls.map((c) => c[1])).toEqual([
      '/v1/cards/card-details',
      '/v1/cards/card-search',
    ]);
    expect(result.row?.card_id).toBe('1694044347157x258677420840309300');
    expect(result.row?.variant).toBe('Master Ball');
  });

  it('does not fall back to Reverse Foil when Master Ball is missing from search', async () => {
    const forwardJson = jest.fn(async (_method, path) => {
      if (path === '/v1/cards/card-search') {
        return {
          cards: [gengarSearchBody.cards[0], gengarSearchBody.cards[1]],
        };
      }
      return {};
    });
    const svc = serviceWithMocks(forwardJson, false, {
      recordResolvePath: jest.fn(),
      recordResolvePath2Pilot: jest.fn(),
    } as unknown as CardhedgerMetricsService);

    const result = await svc.resolveCardForCollection(
      gengarCol({
        psaVariety: 'MASTER BALL REVERSE HOLO',
        marketParallelKey: 'master_ball_reverse_holo',
      }),
    );

    expect(result.row).toBeNull();
  });
});
