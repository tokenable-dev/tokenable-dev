/**
 * Cardhedger matching ambiguity matrix (shadow + collection).
 * Mint Pokémon hardening lives in `pokemon-cardhedger-mint.e2e.spec.ts`.
 * Deterministic mocked candidates only. No live Cardhedger / PSA / staging.
 */
import type { ConfigService } from '@nestjs/config';
import type { TtlCacheProvider } from '../../common/cache/ttl-cache.interface';
import type { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import { CardhedgerCertLookupService } from '../market-data/cardhedger-cert-lookup.service';
import { CardhedgerResolveService } from '../market-data/cardhedger-resolve.service';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import {
  comparePokemonShadowOutcome,
  pickPokemonNormalizedShadowCandidate,
  scorePokemonNormalizedShadowCandidate,
} from './pokemon-cardhedger-normalized-shadow.util';

const ttlCache: TtlCacheProvider = {
  get: () => undefined,
  set: () => undefined,
  delete: () => undefined,
  clearNamespace: () => undefined,
};

function collectionResolveService(forwardJson: jest.Mock): CardhedgerResolveService {
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
          pokemonNormalizedShadow: false,
        };
      }
      if (key === 'marketplace.cardhedgerResolveMatchFirstPilotLog') return false;
      if (key === 'CARDHEDGER_MAX_SEARCH_CANDIDATES') return '4';
      return undefined;
    },
  } as unknown as ConfigService;
  return new CardhedgerResolveService(
    cardhedger,
    config,
    {
      getCardRowByCert: jest.fn().mockResolvedValue({ row: null }),
    } as unknown as CardhedgerCertLookupService,
    ttlCache,
    {
      recordResolvePath: jest.fn(),
      recordResolvePath2Pilot: jest.fn(),
    } as unknown as CardhedgerMetricsService,
  );
}

function gengar151Collection(
  psaVariety: string,
  marketParallelKey = 'base',
): MarketplaceCollection {
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
      psaVariety,
      marketParallelKey,
    },
    coverImageUrl: null,
    psaCertNumber: null,
    marketParallelKey,
    bucketKeyVersion: 2,
    reviewStatus: 'active',
    createdAt: new Date(),
  } satisfies MarketplaceCollection;
}

const GENGAR_151 = {
  card_id: 'gengar-151-base',
  name: 'Gengar',
  description: 'Gengar 2023 Pokemon Japanese Scarlet & Violet 151',
  set: '2023 Pokemon Japanese Scarlet & Violet 151',
  number: '094',
  variant: 'Base',
};
const GENGAR_151_REVERSE = {
  ...GENGAR_151,
  card_id: 'gengar-151-reverse',
  description: 'Gengar 2023 Pokemon Japanese Scarlet & Violet 151 Reverse Foil',
  variant: 'Reverse Foil',
};
const GENGAR_151_MASTER = {
  ...GENGAR_151,
  card_id: 'gengar-151-master',
  description: 'Gengar 2023 Pokemon Japanese Scarlet & Violet 151 Master Ball',
  variant: 'Master Ball',
};
const GENGAR_OTHER_SET = {
  card_id: 'gengar-other-set',
  name: 'Gengar',
  description: 'Gengar 2022 Pokemon Japanese Dark Phantasma',
  set: '2022 Pokemon Japanese Dark Phantasma',
  number: '094',
  variant: 'Base',
};
const GENGAR_FUSION = {
  card_id: 'gengar-fusion',
  name: 'Gengar',
  description: 'Gengar Pokemon Fusion Strike',
  set: '2021 Pokemon Fusion Strike',
  number: '156',
  variant: 'Base',
};

describe('V4 ambiguity matrix — normalized shadow', () => {
  const hints151 = {
    cardName: 'Gengar',
    cardNumber: '094',
    setPhrase: 'Pokemon Japanese 151',
  };

  it('Case A/B — same number different set → only 151 verifies', () => {
    const wrong = scorePokemonNormalizedShadowCandidate(
      GENGAR_OTHER_SET,
      hints151,
      'q',
    );
    const right = scorePokemonNormalizedShadowCandidate(
      GENGAR_151,
      hints151,
      'q',
    );
    expect(wrong?.verified).toBe(false);
    expect(right?.verified).toBe(true);
    const pick = pickPokemonNormalizedShadowCandidate(
      [{ query: 'q', cards: [GENGAR_OTHER_SET, GENGAR_151] }],
      hints151,
    );
    expect(pick?.cardId).toBe('gengar-151-base');
  });

  it('Case C — REVERSE HOLO picks Reverse Foil, rejects Master Ball', () => {
    const pick = pickPokemonNormalizedShadowCandidate(
      [
        {
          query: 'q',
          cards: [GENGAR_151, GENGAR_151_REVERSE, GENGAR_151_MASTER],
        },
      ],
      { ...hints151, psaVariety: 'REVERSE HOLO' },
    );
    expect(pick?.cardId).toBe('gengar-151-reverse');
    expect(
      scorePokemonNormalizedShadowCandidate(
        GENGAR_151_MASTER,
        { ...hints151, psaVariety: 'REVERSE HOLO' },
        'q',
      )?.varietyMatched,
    ).toBe(false);
  });

  it('Case Master Ball — MASTER BALL REVERSE HOLO picks Master Ball, rejects Reverse Foil', () => {
    const pick = pickPokemonNormalizedShadowCandidate(
      [
        {
          query: 'q',
          cards: [GENGAR_151, GENGAR_151_REVERSE, GENGAR_151_MASTER],
        },
      ],
      { ...hints151, psaVariety: 'MASTER BALL REVERSE HOLO' },
    );
    expect(pick?.cardId).toBe('gengar-151-master');
    expect(
      scorePokemonNormalizedShadowCandidate(
        GENGAR_151_REVERSE,
        { ...hints151, psaVariety: 'MASTER BALL REVERSE HOLO' },
        'q',
      )?.varietyMatched,
    ).toBe(false);
  });

  it('Case D — M2 vs M2a shared number cannot cross-set', () => {
    const m2Hints = {
      cardName: 'Mega Charizard X ex',
      cardNumber: '116',
      setPhrase: 'Pokemon Japanese Inferno X',
      psaVariety: 'MEGA ULTRA RARE',
    };
    const charizard = {
      card_id: 'm2-116',
      name: 'Mega Charizard X EX',
      set: '2025 Pokemon Japanese Inferno X',
      number: '116',
      variant: 'Base',
    };
    const wrongSetSameNumber = {
      card_id: 'm2a-116-intruder',
      name: 'Pawniard',
      set: '2025 Pokemon Japanese Mega Dream EX',
      number: '116',
      variant: 'Base',
    };
    const pick = pickPokemonNormalizedShadowCandidate(
      [{ query: 'q', cards: [wrongSetSameNumber, charizard] }],
      m2Hints,
    );
    expect(pick?.cardId).toBe('m2-116');
    expect(
      scorePokemonNormalizedShadowCandidate(wrongSetSameNumber, m2Hints, 'q')
        ?.verified,
    ).toBe(false);
  });

  it('Case E — same name different set rejected by set phrase', () => {
    const pick = pickPokemonNormalizedShadowCandidate(
      [
        {
          query: 'q',
          cards: [GENGAR_OTHER_SET, GENGAR_FUSION, GENGAR_151],
        },
      ],
      hints151,
    );
    expect(pick?.cardId).toBe('gengar-151-base');
  });

  it('Case F — year is NOT a hard gate in shadow scoring', () => {
    const yearMismatch = {
      ...GENGAR_151,
      card_id: 'gengar-151-2024-label',
      set: '2024 Pokemon Japanese Scarlet & Violet 151',
    };
    const c = scorePokemonNormalizedShadowCandidate(
      yearMismatch,
      hints151,
      'q',
    );
    expect(c?.verified).toBe(true);
    expect(c?.setMatched).toBe(true);
  });

  it('Case G — language is not a shadow matching gate', () => {
    // Normalized language is never passed into scorePokemonNormalizedShadowCandidate.
    const c = scorePokemonNormalizedShadowCandidate(GENGAR_151, hints151, 'q');
    expect(c?.verified).toBe(true);
    expect(
      Object.keys(hints151).includes('language' as never),
    ).toBe(false);
  });

  it('Case H — Special Art Rare may match Cardhedger Base', () => {
    const c = scorePokemonNormalizedShadowCandidate(
      GENGAR_151,
      { ...hints151, psaVariety: 'SPECIAL ART RARE' },
      'q',
    );
    expect(c?.varietyMatched).toBe(true);
    expect(c?.verified).toBe(true);
  });

  it('Case I — name+number without set → fail closed (null pick)', () => {
    const pick = pickPokemonNormalizedShadowCandidate(
      [{ query: 'q', cards: [GENGAR_OTHER_SET, GENGAR_FUSION] }],
      hints151,
    );
    expect(pick).toBeNull();
  });

  it('Case J — two verified candidates → highest score then cardId order', () => {
    const a = {
      ...GENGAR_151_REVERSE,
      card_id: 'zzz-later-id',
    };
    const b = {
      ...GENGAR_151_REVERSE,
      card_id: 'aaa-earlier-id',
    };
    const pick = pickPokemonNormalizedShadowCandidate(
      [{ query: 'q', cards: [a, b] }],
      { ...hints151, psaVariety: 'REVERSE HOLO' },
    );
    // Equal verified+score → localeCompare on cardId → aaa wins
    expect(pick?.cardId).toBe('aaa-earlier-id');
  });

  it('shadow vs legacy outcome classification by card id', () => {
    expect(
      comparePokemonShadowOutcome({
        legacyId: 'a',
        legacyVerified: true,
        shadowId: 'a',
        shadowVerified: true,
      }),
    ).toBe('same');
    expect(
      comparePokemonShadowOutcome({
        legacyId: 'a',
        legacyVerified: true,
        shadowId: 'b',
        shadowVerified: true,
      }),
    ).toBe('conflict');
    expect(
      comparePokemonShadowOutcome({
        legacyId: 'a',
        legacyVerified: true,
        shadowId: null,
        shadowVerified: false,
      }),
    ).toBe('legacy_only');
    expect(
      comparePokemonShadowOutcome({
        legacyId: null,
        legacyVerified: false,
        shadowId: 'b',
        shadowVerified: true,
      }),
    ).toBe('shadow_only');
    expect(
      comparePokemonShadowOutcome({
        legacyId: null,
        legacyVerified: false,
        shadowId: null,
        shadowVerified: false,
      }),
    ).toBe('both_fail');
  });
});

describe('V4 ambiguity matrix — collection resolver', () => {
  it('Case A — rejects wrong-set Gengar 094; picks Japanese 151', async () => {
    const forwardJson = jest.fn(async (_m: string, path: string) => {
      if (path === '/v1/cards/card-search') {
        return { cards: [GENGAR_OTHER_SET, GENGAR_151] };
      }
      return {};
    });
    const result = await collectionResolveService(
      forwardJson,
    ).resolveCardForCollection(gengar151Collection(''));
    expect(result.row?.card_id).toBe('gengar-151-base');
    expect(result.confidence).toBe('verified');
  });

  it('Case C / Master Ball — finish distinction among same name/number/set', async () => {
    const body = {
      cards: [GENGAR_151, GENGAR_151_REVERSE, GENGAR_151_MASTER],
    };
    const reverse = await collectionResolveService(
      jest.fn(async (_m, path) =>
        path === '/v1/cards/card-search' ? body : {},
      ),
    ).resolveCardForCollection(
      gengar151Collection('REVERSE HOLO', 'reverse_holo'),
    );
    expect(reverse.row?.card_id).toBe('gengar-151-reverse');

    const master = await collectionResolveService(
      jest.fn(async (_m, path) =>
        path === '/v1/cards/card-search' ? body : {},
      ),
    ).resolveCardForCollection(
      gengar151Collection(
        'MASTER BALL REVERSE HOLO',
        'master_ball_reverse_holo',
      ),
    );
    expect(master.row?.card_id).toBe('gengar-151-master');
  });

  it('Case I — wrong-set-only candidates fail closed', async () => {
    const result = await collectionResolveService(
      jest.fn(async (_m, path) =>
        path === '/v1/cards/card-search'
          ? { cards: [GENGAR_OTHER_SET, GENGAR_FUSION] }
          : {},
      ),
    ).resolveCardForCollection(gengar151Collection(''));
    expect(result.row).toBeNull();
  });

  it('Case H — Special Art Rare may accept Base catalog row', async () => {
    const result = await collectionResolveService(
      jest.fn(async (_m, path) =>
        path === '/v1/cards/card-search' ? { cards: [GENGAR_151] } : {},
      ),
    ).resolveCardForCollection(gengar151Collection('SPECIAL ART RARE'));
    expect(result.row?.card_id).toBe('gengar-151-base');
    expect(result.confidence).toBe('verified');
  });
});
