import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { DataInventoryService } from './data-inventory.service';

describe('DataInventoryService.resetForNewContract', () => {
  function makeService(opts: {
    isProduction: boolean;
    resetPassword?: string;
  }) {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('to_regclass')) {
        return [{ reg: 'public.rwa_tokens' }];
      }
      if (sql.includes('COUNT(*)')) {
        return [{ n: 3 }];
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
      {} as never,
      {} as never,
      {} as never,
      dataSource,
      config,
    );

    return { service, query };
  }

  it('rejects in production', async () => {
    const { service } = makeService({ isProduction: true });
    await expect(service.resetForNewContract('3009')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects wrong password', async () => {
    const { service } = makeService({
      isProduction: false,
      resetPassword: '3009',
    });
    await expect(service.resetForNewContract('wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('truncates marketplace tables when password matches', async () => {
    const { service, query } = makeService({
      isProduction: false,
      resetPassword: '3009',
    });
    const result = await service.resetForNewContract('3009');
    expect(result.truncatedTables.length).toBeGreaterThan(0);
    expect(result.rowCountsBefore.rwa_tokens).toBe(3);
    expect(
      query.mock.calls.some(
        (c) =>
          typeof c[0] === 'string' &&
          c[0].includes('TRUNCATE TABLE') &&
          c[0].includes('rwa_tokens'),
      ),
    ).toBe(true);
  });
});
