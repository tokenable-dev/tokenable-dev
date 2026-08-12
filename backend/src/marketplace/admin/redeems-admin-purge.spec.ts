import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { VaultCycle } from '../../vault/entities/vault-cycle.entity';
import type { VaultRedemption } from '../../vault/entities/vault-redemption.entity';
import type { RwaToken } from '../entities/rwa-token.entity';
import { RedeemsAdminService } from './redeems-admin.service';

describe('RedeemsAdminService.purgeAllDevData', () => {
  function makeService(isProduction: boolean) {
    const execute = jest
      .fn()
      .mockResolvedValueOnce({}) // delete redemptions
      .mockResolvedValueOnce({}) // delete claims
      .mockResolvedValueOnce({ affected: 2 }) // cycles
      .mockResolvedValueOnce({ affected: 1 }); // tokens

    const qb = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute,
    };

    const em = {
      count: jest
        .fn()
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const redemptions = {
      manager: {
        transaction: (fn: (manager: typeof em) => Promise<unknown>) => fn(em),
      },
    } as unknown as Repository<VaultRedemption>;

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'app.isProduction') return isProduction;
        if (key === 'NODE_ENV') return isProduction ? 'production' : 'development';
        return undefined;
      }),
    } as unknown as ConfigService;

    const service = new RedeemsAdminService(
      redemptions,
      {} as Repository<VaultCycle>,
      {} as Repository<RwaToken>,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      config,
      {} as never,
    );

    return { service, em };
  }

  it('rejects in production', async () => {
    const { service } = makeService(true);
    await expect(service.purgeAllDevData()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('deletes redeem tables and returns counts in non-production', async () => {
    const { service } = makeService(false);
    await expect(service.purgeAllDevData()).resolves.toEqual({
      deletedRedemptions: 5,
      deletedPaymentClaims: 2,
      resetVaultCycles: 2,
      clearedTokenBurns: 1,
    });
  });
});
