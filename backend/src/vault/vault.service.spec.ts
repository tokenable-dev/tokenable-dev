import { ConflictException } from '@nestjs/common';
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
    {
      notifyWithdrawalRequested: jest.fn(),
      notifyWithdrawalShipped: jest.fn(),
    } as never,
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
