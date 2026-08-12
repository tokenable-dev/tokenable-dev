import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { RwaToken } from '../marketplace/entities/rwa-token.entity';
import type { VaultAsset } from './entities/vault-asset.entity';
import type { VaultCycle } from './entities/vault-cycle.entity';
import type { VaultRedemption } from './entities/vault-redemption.entity';
import { VaultService } from './vault.service';

const SEPOLIA = 11155111;
const POLYGON = 137;

/**
 * Simulates the chain-scoped open-cycle lookup: getOne() returns the stored
 * open cycle only when the query's chainId parameter matches its chain.
 */
function makeCyclesRepo(openCycle: { chainId: number; cycleNumber: number; status: string } | null) {
  let queriedChainId: number | undefined;
  return {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn(function (
        this: unknown,
        _cond: string,
        params?: Record<string, unknown>,
      ) {
        if (params && typeof params.chainId === 'number') {
          queriedChainId = params.chainId;
        }
        return this;
      }),
      getOne: jest.fn(() =>
        Promise.resolve(
          openCycle && openCycle.chainId === queriedChainId ? openCycle : null,
        ),
      ),
    })),
  } as unknown as Repository<VaultCycle>;
}

function makeService(
  openCycle: { chainId: number; cycleNumber: number; status: string } | null,
) {
  const assets = {
    findOne: jest.fn(() => Promise.resolve({ id: 'asset-1' })),
  } as unknown as Repository<VaultAsset>;
  return new VaultService(
    assets,
    makeCyclesRepo(openCycle),
    {} as Repository<VaultRedemption>,
    {} as never, // paymentClaims
    {} as Repository<RwaToken>,
    {} as never, // marketplacePartners
    {
      notifyWithdrawalRequested: jest.fn(),
      notifyWithdrawalShipped: jest.fn(),
      notifyRedeemPaymentReceived: jest.fn(),
    } as never,
    { getDefaultChainId: jest.fn(() => 11155111) } as never,
  );
}

describe('VaultService.assertAvailableForNewCycle (chain-scoped)', () => {
  const sepoliaCycle = { chainId: SEPOLIA, cycleNumber: 1, status: 'minted' };

  it('blocks a new cycle on the chain that already has an open cycle', async () => {
    await expect(
      makeService(sepoliaCycle).assertAvailableForNewCycle('123123123', SEPOLIA),
    ).rejects.toThrow(ConflictException);
  });

  it('allows the same cert on a different chain (Sepolia mint must not block Polygon)', async () => {
    await expect(
      makeService(sepoliaCycle).assertAvailableForNewCycle('123123123', POLYGON),
    ).resolves.toBeUndefined();
  });

  it('allows an unknown cert on any chain', async () => {
    const service = makeService(null);
    (
      service as unknown as { assets: { findOne: jest.Mock } }
    ).assets.findOne.mockResolvedValue(null);
    await expect(
      service.assertAvailableForNewCycle('999999999', POLYGON),
    ).resolves.toBeUndefined();
  });
});

describe('VaultService.assertTokensRedeemable', () => {
  function makeRedeemableService(
    tokens: Array<Partial<RwaToken>>,
    cycles: Array<{ id: string; status: string }> = [],
  ) {
    const rwaTokens = {
      find: jest.fn(() => Promise.resolve(tokens)),
    } as unknown as Repository<RwaToken>;
    const cyclesRepo = {
      find: jest.fn(() => Promise.resolve(cycles)),
    } as unknown as Repository<VaultCycle>;
    return new VaultService(
      {} as Repository<VaultAsset>,
      cyclesRepo,
      {} as Repository<VaultRedemption>,
      {} as never,
      rwaTokens,
      {} as never,
      {} as never,
      { getDefaultChainId: jest.fn(() => SEPOLIA) } as never,
    );
  }

  const contract = '0xabc';

  it('rejects a token that has no registry row', async () => {
    await expect(
      makeRedeemableService([]).assertTokensRedeemable(contract, ['49']),
    ).rejects.toThrow(/not registered/);
  });

  it('rejects an already-burned token', async () => {
    await expect(
      makeRedeemableService([
        { tokenId: '49', burnedAt: new Date(), vaultCycleId: 'c1' },
      ]).assertTokensRedeemable(contract, ['49']),
    ).rejects.toThrow(/already been redeemed/);
  });

  it('rejects missing cycle when no cert number (unhealable)', async () => {
    await expect(
      makeRedeemableService([
        { tokenId: '49', burnedAt: null, vaultCycleId: null, certNumber: null },
      ]).assertTokensRedeemable(contract, ['49']),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows missing cycle when cert is on file (backfilled at pay)', async () => {
    await expect(
      makeRedeemableService([
        {
          tokenId: '49',
          burnedAt: null,
          vaultCycleId: null,
          certNumber: '12345678',
        },
      ]).assertTokensRedeemable(contract, ['49']),
    ).resolves.toBeUndefined();
  });

  it('rejects when the vault cycle is not minted', async () => {
    await expect(
      makeRedeemableService(
        [{ tokenId: '49', burnedAt: null, vaultCycleId: 'c1' }],
        [{ id: 'c1', status: 'redemption_requested' }],
      ).assertTokensRedeemable(contract, ['49']),
    ).rejects.toThrow(ConflictException);
  });

  it('passes a healthy minted token', async () => {
    await expect(
      makeRedeemableService(
        [{ tokenId: '49', burnedAt: null, vaultCycleId: 'c1' }],
        [{ id: 'c1', status: 'minted' }],
      ).assertTokensRedeemable(contract, ['49']),
    ).resolves.toBeUndefined();
  });
});
