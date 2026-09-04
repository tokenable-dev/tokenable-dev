import { CollectionService } from './collection.service';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import { Order } from '../entities/order.entity';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { RwaToken } from '../entities/rwa-token.entity';

describe('CollectionService.adminDeleteCollectionCompletely', () => {
  it('unlinks rwa_tokens.collection_key instead of deleting mint registry rows', async () => {
    const em = {
      delete: jest.fn(async (entity: unknown) => {
        if (entity === CollectionMarketSnapshot) return { affected: 1 };
        if (entity === Order) return { affected: 2 };
        if (entity === MarketplaceCollection) return { affected: 1 };
        if (entity === RwaToken) {
          throw new Error('must not delete rwa_tokens');
        }
        return { affected: 0 };
      }),
      createQueryBuilder: jest.fn(() => {
        const qb = {
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 4 }),
        };
        return qb;
      }),
    };

    const collectionRepo = {
      findOne: jest.fn().mockResolvedValue({ collectionKey: 'ohtani-key' }),
      manager: {
        transaction: async (fn: (m: typeof em) => Promise<unknown>) => fn(em),
      },
    };

    const merkleSet = { invalidateForCollection: jest.fn() };
    const identity = {
      hydrateCardhedgerCardId: jest.fn(async (row: unknown) => row),
    };

    const service = new CollectionService(
      collectionRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      merkleSet as never,
      {} as never,
      {} as never,
      identity as never,
      {} as never,
      {} as never,
    );

    const result = await service.adminDeleteCollectionCompletely('ohtani-key');

    expect(em.delete).not.toHaveBeenCalledWith(RwaToken, expect.anything());
    expect(em.createQueryBuilder).toHaveBeenCalled();
    expect(result.unlinkedRwaTokens).toBe(4);
    expect(result.deletedCollection).toBe(true);
    expect(merkleSet.invalidateForCollection).toHaveBeenCalledWith('ohtani-key');
  });
});
