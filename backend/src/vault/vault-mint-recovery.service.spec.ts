import { VaultMintRecoveryService } from './vault-mint-recovery.service';

describe('VaultMintRecoveryService', () => {
  function makeService(overrides?: {
    list?: Array<{
      cycle: { id: string; chainId: number; updatedAt: Date };
      asset: { vaultRef: string };
      attempt: {
        tokenURI: string;
        certNumber: string;
        settlementPolicy: 'standard' | 'self_vault_hold';
        vaultPartnerId?: string | null;
        ownerWallet: string;
        tokenId?: string | null;
        txHash?: string | null;
      };
    }>;
    activeTokenId?: number;
  }) {
    const vault = {
      listMintingCyclesForRecovery: jest
        .fn()
        .mockResolvedValue(overrides?.list ?? []),
      recordMintResult: jest.fn().mockResolvedValue(undefined),
      cancelCycle: jest.fn().mockResolvedValue(undefined),
    };
    const blockchain = {
      getActiveTokenIdOfVaultRef: jest
        .fn()
        .mockResolvedValue(overrides?.activeTokenId ?? 0),
      getRwaTokenURI: jest.fn().mockResolvedValue('ipfs://recovered'),
      getRwaTokenOwner: jest.fn().mockResolvedValue('0xowner'),
    };
    const chainConfig = {
      listConfiguredChainIds: () => [11155111],
      getRwaAddress: () => '0xrwa',
    };
    const config = { get: jest.fn(() => undefined) };
    const svc = new VaultMintRecoveryService(
      vault as never,
      blockchain as never,
      chainConfig as never,
      config as never,
    );
    return { svc, vault, blockchain };
  }

  it('heals minting cycle when attempt has tokenId', async () => {
    const { svc, vault } = makeService({
      list: [
        {
          cycle: {
            id: 'c1',
            chainId: 11155111,
            updatedAt: new Date(),
          },
          asset: { vaultRef: `0x${'11'.repeat(32)}` },
          attempt: {
            tokenURI: 'ipfs://Qm',
            certNumber: '164014763',
            settlementPolicy: 'self_vault_hold',
            vaultPartnerId: 'partner-1',
            ownerWallet: '0xabc',
            tokenId: '115',
            txHash: '0xtx',
          },
        },
      ],
    });

    const result = await svc.recoverPass();
    expect(result.healed).toBe(1);
    expect(vault.recordMintResult).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleId: 'c1',
        tokenId: '115',
        settlementPolicy: 'self_vault_hold',
        vaultPartnerId: 'partner-1',
        certNumber: '164014763',
      }),
    );
  });

  it('resolves tokenId from chain when attempt lacks tokenId', async () => {
    const { svc, vault, blockchain } = makeService({
      activeTokenId: 42,
      list: [
        {
          cycle: {
            id: 'c2',
            chainId: 11155111,
            updatedAt: new Date(),
          },
          asset: { vaultRef: `0x${'22'.repeat(32)}` },
          attempt: {
            tokenURI: 'ipfs://Qm2',
            certNumber: '111',
            settlementPolicy: 'standard',
            ownerWallet: '0xcustody',
          },
        },
      ],
    });

    await svc.recoverPass();
    expect(blockchain.getActiveTokenIdOfVaultRef).toHaveBeenCalled();
    expect(vault.recordMintResult).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenId: '42',
        settlementPolicy: 'standard',
      }),
    );
  });

  it('cancels stale minting with no on-chain token', async () => {
    const old = new Date(Date.now() - 31 * 60_000);
    const { svc, vault } = makeService({
      activeTokenId: 0,
      list: [
        {
          cycle: { id: 'c3', chainId: 11155111, updatedAt: old },
          asset: { vaultRef: `0x${'33'.repeat(32)}` },
          attempt: {
            tokenURI: 'ipfs://x',
            certNumber: '222',
            settlementPolicy: 'standard',
            ownerWallet: '0xcustody',
          },
        },
      ],
    });

    const result = await svc.recoverPass();
    expect(result.cancelled).toBe(1);
    expect(vault.cancelCycle).toHaveBeenCalledWith(
      'c3',
      expect.stringContaining('no on-chain token'),
    );
    expect(vault.recordMintResult).not.toHaveBeenCalled();
  });
});
