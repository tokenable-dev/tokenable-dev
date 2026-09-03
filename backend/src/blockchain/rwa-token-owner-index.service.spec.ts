import { RwaTokenOwnerIndexService } from './rwa-token-owner-index.service';

describe('RwaTokenOwnerIndexService', () => {
  const contract = '0xabc0000000000000000000000000000000000001';

  function makeService() {
    const rwaTokens = {
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
      count: jest.fn(),
    };
    const cursors = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const chainConfig = {
      getDefaultChainId: () => 11155111,
      getRwaAddress: () => contract,
      createJsonRpcProvider: jest.fn(),
      listConfiguredChainIds: () => [11155111],
    };
    const config = {
      get: jest.fn(() => undefined),
    };
    const svc = new RwaTokenOwnerIndexService(
      rwaTokens as never,
      cursors as never,
      chainConfig as never,
      config as never,
    );
    return { svc, rwaTokens, cursors };
  }

  it('recordTransfer to zero address clears owner and marks burned when not yet burned', async () => {
    const { svc, rwaTokens } = makeService();
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    rwaTokens.createQueryBuilder.mockReturnValue(qb);

    await svc.recordTransfer(
      contract,
      7,
      '0x1111111111111111111111111111111111111111',
      '0x0000000000000000000000000000000000000000',
    );

    expect(qb.update).toHaveBeenCalled();
    expect(qb.set).toHaveBeenCalledWith({
      ownerWallet: null,
      burnedAt: expect.any(Function),
    });
  });

  it('recordOwner upserts owner_wallet only (preserves burned_at on conflict)', async () => {
    const { svc, rwaTokens } = makeService();
    const qb = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orUpdate: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    rwaTokens.createQueryBuilder.mockReturnValue(qb);

    await svc.recordOwner(
      contract,
      3,
      '0x2222222222222222222222222222222222222222',
    );

    expect(qb.orUpdate).toHaveBeenCalledWith(
      ['owner_wallet'],
      ['token_contract', 'token_id'],
    );
  });

  it('isIndexReady reads cursor.backfillComplete', async () => {
    const { svc, cursors } = makeService();
    cursors.findOne.mockResolvedValue({ backfillComplete: true });
    await expect(svc.isIndexReady()).resolves.toBe(true);
  });

  it('buildHolderIndex groups indexed rows by owner_wallet', async () => {
    const { svc, rwaTokens } = makeService();
    rwaTokens.find.mockResolvedValue([
      { tokenId: '2', ownerWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      { tokenId: '5', ownerWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      { tokenId: '3', ownerWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    ]);

    const index = await svc.buildHolderIndex();
    expect(index.get('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toEqual([
      2, 5,
    ]);
    expect(index.get('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).toEqual([3]);
  });

  it('shouldBackfillChain requires deploy block on every chain', () => {
    const { svc } = makeService();
    expect(svc.shouldBackfillChain(11155111, 0)).toBe(false);
    expect(svc.shouldBackfillChain(11155111, 12_000)).toBe(true);
    expect(svc.shouldBackfillChain(137, 0)).toBe(false);
    expect(svc.shouldBackfillChain(137, 12_000)).toBe(true);
  });
});
