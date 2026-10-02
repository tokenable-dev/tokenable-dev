import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import type { ChainConfigService } from '../../blockchain/chain-config.service';
import { DataInventoryService } from './data-inventory.service';

const SEPOLIA = 11155111;
const ADDR = '0xf7242f62153ac2f42cbf331724f38b93829381c3';

describe('DataInventoryService.pruneChainResidue', () => {
  function makeService(resetPassword = '3009') {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('to_regclass')) {
        return [{ reg: 'public.vault_cycles' }];
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
        if (key === 'marketplace.adminDbResetPassword') return resetPassword;
        return undefined;
      }),
    } as unknown as ConfigService;

    const chainConfig = {
      isChainConfigured: () => true,
      getRwaAddress: () => ADDR,
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

  it('rejects wrong password', async () => {
    const { service } = makeService('3009');
    await expect(
      service.pruneChainResidue('wrong', SEPOLIA, false),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('deletes orphan vault cycles and legacy submissions without touching rwa_tokens', async () => {
    const { service, query } = makeService();
    const result = await service.pruneChainResidue('3009', SEPOLIA, false);
    expect(result.chainId).toBe(SEPOLIA);
    expect(result.rwaAddress).toBe(ADDR.toLowerCase());
    const sql = query.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sql).toContain('rwa_tokens t WHERE t.vault_cycle_id = vault_cycles.id');
    expect(sql).toContain('DELETE FROM "vault_submissions"');
    expect(sql).toContain('chain_id IS NULL OR chain_id = $1');
    expect(sql).toContain('IS NOT DISTINCT FROM $1');
    expect(sql).not.toContain('DELETE FROM "rwa_tokens"');
    expect(sql).not.toContain('TRUNCATE');
  });

  it('truncates PSA review tables when requested', async () => {
    const { service, query } = makeService();
    await service.pruneChainResidue('3009', SEPOLIA, true);
    const sql = query.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sql).toContain('TRUNCATE "vault_psa_arrival_reviews"');
    expect(sql).toContain('TRUNCATE "vault_psa_vaulted_reviews"');
  });
});
