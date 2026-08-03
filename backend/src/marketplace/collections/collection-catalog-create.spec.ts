import { BadRequestException } from '@nestjs/common';
import { CollectionService } from './collection.service';

describe('CollectionService.createCatalogCollectionFromPsaCert', () => {
  const psaCert = {
    CertNumber: '83179580',
    Subject: 'Charizard',
    Brand: 'Base Set',
    Year: '1999',
    CardNumber: '4',
    Grade: '10',
    GradeDescription: 'GEM MT 10',
    SpecID: 12345,
  };

  function buildService(overrides?: {
    getByCertNumber?: jest.Mock;
    insertIdentifiers?: unknown[];
  }) {
    const valuesMock = jest.fn().mockReturnThis();
    const collectionRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: valuesMock,
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          identifiers: overrides?.insertIdentifiers ?? [{ collectionKey: 'abc' }],
        }),
      }),
      findOne: jest.fn().mockResolvedValue({
        collectionKey: 'abc',
        displayLabel: '1999 Base Set Charizard PSA 10',
        reviewStatus: 'pending_review',
        coverImageUrl: null,
        psaCertNumber: '83179580',
        components: { cardhedgerCardId: 'ch_catalog_1' },
      }),
      update: jest.fn().mockResolvedValue(undefined),
      valuesMock,
    };

    const psaPublicApi = {
      getByCertNumber: overrides?.getByCertNumber ??
        jest.fn().mockResolvedValue({
          status: 'success',
          certNumber: '83179580',
          raw: { PSACert: psaCert },
        }),
      getImagesByCertNumber: jest.fn().mockResolvedValue({
        status: 'success',
        raw: [
          {
            ImageURL: 'https://images.pokemontcg.io/base1/4/large.png',
            IsFrontImage: true,
          },
        ],
      }),
    };

    const cover = {
      attachCardhedgerFromPsaCert: jest.fn().mockImplementation(
        async (meta: Record<string, unknown>) => ({
          ...meta,
          properties: {
            ...((meta.properties as Record<string, unknown>) ?? {}),
            graded: {
              ...(((meta.properties as Record<string, unknown>)?.graded ??
                {}) as Record<string, unknown>),
              cardhedger: {
                cardId: 'ch_catalog_1',
                searchQuery: 'Charizard Base Set',
              },
            },
          },
        }),
      ),
      resolveCoverUrlForNewCollection: jest.fn().mockResolvedValue(null),
      upgradeCoverFromMetaIfBetter: jest.fn().mockResolvedValue(undefined),
    };
    const components = {
      mergePsaPopulationFromMetaIfMissing: jest.fn(),
      mergeCardhedgerCardIdFromMetaIfMissing: jest.fn(),
      mergeListingDisplayTitleFromMetaIfMissing: jest.fn(),
      mergeTrendingSlabMetaFromMetaIfMissing: jest.fn(),
      mergePsaSpecIdFromCertIfMissing: jest.fn(),
      ensurePsaSpecPopulationFromApi: jest.fn().mockResolvedValue(undefined),
    };
    const identity = {
      isEnabled: jest.fn().mockReturnValue(false),
      seedFromMintMetadataOnInsert: jest.fn(),
      writeFromCertLookup: jest.fn(),
      hydrateCardhedgerCardId: jest.fn(async (row: unknown) => row),
    };
    const eventEmitter = { emit: jest.fn() };

    const service = new CollectionService(
      collectionRepo as never,
      {} as never,
      {} as never,
      { getDefaultChainId: () => 11155111 } as never,
      { get: () => undefined } as never,
      {} as never,
      { upsertFromMetadata: jest.fn() } as never,
      eventEmitter as never,
      {} as never,
      cover as never,
      components as never,
      identity as never,
      psaPublicApi as never,
      {} as never,
    );

    return { service, psaPublicApi, collectionRepo, eventEmitter, cover };
  }

  it('creates a pending_review catalog collection from PSA cert', async () => {
    const { service, eventEmitter, cover, collectionRepo } = buildService();
    const result = await service.createCatalogCollectionFromPsaCert('83179580');

    expect(result.created).toBe(true);
    expect(result.collectionKey).toBeTruthy();
    expect(result.reviewStatus).toBe('pending_review');
    expect(result.psaCertNumber).toBe('83179580');
    expect(cover.attachCardhedgerFromPsaCert).toHaveBeenCalledWith(
      expect.any(Object),
      '83179580',
    );
    const insertValues = (collectionRepo as { valuesMock: jest.Mock }).valuesMock
      .mock.calls[0]?.[0] as { components?: Record<string, unknown> };
    expect(insertValues.components?.cardhedgerCardId).toBe('ch_catalog_1');
    expect(insertValues.components?.cardhedgerCardIdSource).toBe('psa_cert');
    expect(eventEmitter.emit).toHaveBeenCalledWith('snapshot.enqueue', {
      key: expect.any(String),
      reason: 'cold_start',
    });
  });

  it('rejects invalid cert numbers', async () => {
    const { service } = buildService();
    await expect(
      service.createCatalogCollectionFromPsaCert('abc'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when PSA response has no PSACert', async () => {
    const { service } = buildService({
      getByCertNumber: jest.fn().mockResolvedValue({
        status: 'success',
        certNumber: '83179580',
        raw: {},
      }),
    });
    await expect(
      service.createCatalogCollectionFromPsaCert('83179580'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
