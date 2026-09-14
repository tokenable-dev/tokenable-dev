import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import type { ChainConfigService } from '../../blockchain/chain-config.service';
import { DataInventoryService } from './data-inventory.service';

const SEPOLIA = 11155111;
const ADDR = '0x1111111111111111111111111111111111111111';

describe('DataInventoryService.resetForNewContract', () => {
  function makeService(opts: {
    isProduction: boolean;
    resetPassword?: string;
    configuredAddress?: string;
  }) {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('to_regclass')) {
        return [{ reg: 'public.rwa_tokens' }];
      }
      if (sql.includes('COUNT(*)')) {
        return [{ n: 2 }];
      }
      if (sql.includes('collection_key')) {
        return [{ k: 'charizard' }];
      }
      if (sql.includes('cert_number')) {
        return [{ c: '12345678' }];
      }
      return [];
    });

    const dataSource = {
      query,
      transaction: async (fn: (m: { query: typeof query }) => Promise<unknown>) =>
        fn({ query }),
    } as unknown as DataSource;

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'app.isProduction') return opts.isProduction;
        if (key === 'NODE_ENV') {
          return opts.isProduction ? 'production' : 'development';
        }
        if (key === 'marketplace.adminDbResetPassword') {
          return opts.resetPassword ?? '3009';
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    const chainConfig = {
      isChainConfigured: () => true,
      getRwaAddress: () => opts.configuredAddress ?? ADDR,
      listConfiguredChainIds: () => [SEPOLIA],
    } as unknown as ChainConfigService;

    const service = new DataInventoryService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      dataSource,
      config,
      chainConfig,
    );

    return { service, query };
  }

  it('rejects in production', async () => {
    const { service } = makeService({ isProduction: true });
    await expect(
      service.resetForNewContract('3009', SEPOLIA, ADDR),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects wrong password', async () => {
    const { service } = makeService({
      isProduction: false,
      resetPassword: '3009',
    });
    await expect(
      service.resetForNewContract('wrong', SEPOLIA, ADDR),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('deletes only the selected contract, not a full truncate', async () => {
    const { service, query } = makeService({
      isProduction: false,
      resetPassword: '3009',
    });
    const result = await service.resetForNewContract('3009', SEPOLIA, ADDR);
    expect(result.tokenContract).toBe(ADDR);
    expect(result.wipedConfiguredContract).toBe(true);
    expect(result.deletedCounts.rwa_tokens).toBe(2);
    const sql = query.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sql).toContain('DELETE FROM "rwa_tokens"');
    expect(sql).toContain('lower(token_contract) = $1');
    expect(sql).not.toContain('TRUNCATE TABLE');
    const calls = query.mock.calls as unknown as [string, unknown[]][];
    expect(
      calls.some(
        ([sql, params]) =>
          sql.includes('DELETE FROM "orders"') && params?.includes(ADDR),
      ),
    ).toBe(true);
  });

  it('does not wipe chain-scoped inbox when the address is a previous contract', async () => {
    const { service, query } = makeService({
      isProduction: false,
      resetPassword: '3009',
      configuredAddress: '0x2222222222222222222222222222222222222222',
    });
    const result = await service.resetForNewContract('3009', SEPOLIA, ADDR);
    expect(result.wipedConfiguredContract).toBe(false);
    const sql = query.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sql).not.toContain('DELETE FROM "marketplace_notifications"');
    expect(sql).toContain('DELETE FROM "rwa_tokens"');
  });
});
