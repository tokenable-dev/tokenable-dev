import { CollectionService } from './collection.service';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import { Order } from '../entities/order.entity';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { RwaToken } from '../entities/rwa-token.entity';

describe('CollectionService.adminDeleteCollectionCompletely', () => {
  /** Build a minimal service with a given em mock and optional count override. */
  function buildService(
    em: Record<string, jest.Mock>,
    rowCount: number,
  ) {
    const collectionRepo = {
      findOne: jest.fn().mockResolvedValue({
        collectionKey: 'ohtani-key',
        tokenContract: '0xrwa1',
      }),
      count: jest.fn().mockResolvedValue(rowCount),
      manager: {
        transaction: async (fn: (m: typeof em) => Promise<unknown>) => fn(em),
      },
    };
    const chainConfig = {
      getDefaultChainId: jest.fn().mockReturnValue(11155111),
      getRwaAddress: jest.fn().mockReturnValue('0xrwa1'),
    };
    const merkleSet = { invalidateForCollection: jest.fn() };
    const identity = {
      hydrateCardhedgerCardId: jest.fn(async (row: unknown) => row),
    };
    // Constructor order: collectionRepo, orderRepo, rwaTokenRepo, blockchain,
    //   chainConfig, config, ipfsResolver, rwaTokenRegistry, eventEmitter,
    //   merkleSet, cover, components, identity, psaPublicApi, boot.
    return {
      service: new CollectionService(
        collectionRepo as never,
        {} as never,
        {} as never,
        {} as never,
        chainConfig as never,
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
      ),
      merkleSet,
    };
  }

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
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 4 }),
      })),
    };

    const { service, merkleSet } = buildService(em, 1);
    const result = await service.adminDeleteCollectionCompletely('ohtani-key');

    expect(em.delete).not.toHaveBeenCalledWith(RwaToken, expect.anything());
    expect(em.createQueryBuilder).toHaveBeenCalled();
    expect(result.unlinkedRwaTokens).toBe(4);
    expect(result.deletedCollection).toBe(true);
    expect(merkleSet.invalidateForCollection).toHaveBeenCalledWith('ohtani-key');
    // Chain-scoped: snapshot deleted because this is the last chain row
    expect(result.deletedSnapshots).toBe(1);
    // Chain-scoped: orders deleted for specific key + contract
    expect(em.delete).toHaveBeenCalledWith(Order, {
      collectionKey: 'ohtani-key',
      tokenContract: '0xrwa1',
    });
  });

  it('preserves snapshot when another chain row remains', async () => {
    const em = {
      delete: jest.fn(async (entity: unknown) => {
        if (entity === MarketplaceCollection) return { affected: 1 };
        if (entity === Order) return { affected: 0 };
        return { affected: 0 };
      }),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      })),
    };

    const { service } = buildService(em, 2);
    const result = await service.adminDeleteCollectionCompletely('ohtani-key');

    // Snapshot NOT deleted when another chain row remains.
    expect(result.deletedSnapshots).toBe(0);
    expect(em.delete).not.toHaveBeenCalledWith(
      CollectionMarketSnapshot,
      expect.anything(),
    );
  });
});
