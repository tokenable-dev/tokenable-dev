import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChainConfigService } from '../../blockchain/chain-config.service';
import {
  PortfolioCostBasisSource,
  PortfolioHolding,
} from '../entities/portfolio-holding.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { PortfolioHoldingService } from './portfolio-holding.service';

const WALLET = '0x1111111111111111111111111111111111111111';
const CONTRACT = '0x2222222222222222222222222222222222222222';

describe('PortfolioHoldingService', () => {
  let service: PortfolioHoldingService;
  const rows = new Map<number, PortfolioHolding>();
  let nextId = 1;

  const holdingRepo = {
    find: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      return [...rows.values()].filter((r) => {
        if (where.walletAddress && r.walletAddress !== where.walletAddress) {
          return false;
        }
        if (where.tokenContract && r.tokenContract !== where.tokenContract) {
          return false;
        }
        if (where.tokenId != null) {
          if (Array.isArray(where.tokenId)) {
            const ids = (where.tokenId as { _value?: number[] })._value;
            if (ids && !ids.includes(r.tokenId)) return false;
          } else if (r.tokenId !== where.tokenId) {
            return false;
          }
        }
        if (where.hiddenAt != null) {
          const op = where.hiddenAt as { _type?: string };
          if (op._type === 'not' && r.hiddenAt == null) return false;
        }
        return true;
      });
    }),
    findOne: jest.fn(
      async ({ where }: { where: Record<string, unknown> }) => {
        const tid = where.tokenId as number;
        return rows.get(tid) ?? null;
      },
    ),
    save: jest.fn(async (row: PortfolioHolding) => {
      if (!row.id) {
        row.id = nextId++;
        rows.set(row.tokenId, { ...row });
      } else {
        rows.set(row.tokenId, { ...row });
      }
      return row;
    }),
    create: jest.fn((partial: Partial<PortfolioHolding>) => partial as PortfolioHolding),
    delete: jest.fn(async (id: number) => {
      for (const [tid, row] of rows) {
        if (row.id === id) rows.delete(tid);
      }
    }),
  };

  const chainConfig = {
    getDefaultChainId: () => 11155111,
    getRwaAddress: () => CONTRACT,
  };

  const registryCreatedAt = new Map<string, Date>();
  const rwaTokenRepo = {
    find: jest.fn(
      async ({
        where,
      }: {
        where: { tokenId?: { _value?: string[] } | string[] };
      }) => {
        const ids = Array.isArray(where.tokenId)
          ? where.tokenId
          : ((where.tokenId as { _value?: string[] } | undefined)?._value ??
            []);
        return ids
          .map((tid) => {
            const createdAt = registryCreatedAt.get(String(tid));
            if (!createdAt) return null;
            return { tokenId: String(tid), createdAt };
          })
          .filter(Boolean);
      },
    ),
  };

  beforeEach(async () => {
    rows.clear();
    nextId = 1;
    registryCreatedAt.clear();
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PortfolioHoldingService,
        { provide: getRepositoryToken(PortfolioHolding), useValue: holdingRepo },
        { provide: getRepositoryToken(RwaToken), useValue: rwaTokenRepo },
        { provide: ChainConfigService, useValue: chainConfig },
      ],
    }).compile();

    service = moduleRef.get(PortfolioHoldingService);
  });

  it('seeds vault_delivery cost basis on a new row', async () => {
    const acquiredAt = new Date('2026-07-06T12:00:00.000Z');
    await service.seedVaultDeliveryCostBasis(WALLET, 42, 1500, acquiredAt);

    const row = rows.get(42);
    expect(row?.costBasisUsd).toBe(1500);
    expect(row?.costBasisSource).toBe(PortfolioCostBasisSource.VAULT_DELIVERY);
    expect(row?.acquiredAt?.toISOString()).toBe(acquiredAt.toISOString());
  });

  it('does not overwrite manual cost basis with vault seed', async () => {
    await service.setManualCostBasis(WALLET, 7, 900);
    await service.seedVaultDeliveryCostBasis(WALLET, 7, 1500);

    const row = rows.get(7);
    expect(row?.costBasisUsd).toBe(900);
    expect(row?.costBasisSource).toBe(PortfolioCostBasisSource.MANUAL);
  });

  it('overwrites vault_delivery with a newer vault seed', async () => {
    await service.seedVaultDeliveryCostBasis(WALLET, 3, 1000);
    await service.seedVaultDeliveryCostBasis(WALLET, 3, 1200);

    const row = rows.get(3);
    expect(row?.costBasisUsd).toBe(1200);
    expect(row?.costBasisSource).toBe(PortfolioCostBasisSource.VAULT_DELIVERY);
  });

  it('rejects invalid manual cost basis', async () => {
    await expect(service.setManualCostBasis(WALLET, 1, -5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('unhide deletes row when only hidden flag was set', async () => {
    await service.hide(WALLET, 99);
    expect(rows.get(99)?.hiddenAt).not.toBeNull();

    await service.unhide(WALLET, 99);
    expect(rows.has(99)).toBe(false);
  });

  it('seeds marketplace_buy cost basis on a new row', async () => {
    const acquiredAt = new Date('2026-07-07T10:00:00.000Z');
    await service.seedMarketplaceBuyCostBasis(WALLET, 11, 145, acquiredAt);

    const row = rows.get(11);
    expect(row?.costBasisUsd).toBe(145);
    expect(row?.costBasisSource).toBe(PortfolioCostBasisSource.MARKETPLACE_BUY);
  });

  it('does not overwrite manual cost basis with marketplace buy seed', async () => {
    await service.setManualCostBasis(WALLET, 12, 80);
    await service.seedMarketplaceBuyCostBasis(WALLET, 12, 145);

    const row = rows.get(12);
    expect(row?.costBasisUsd).toBe(80);
    expect(row?.costBasisSource).toBe(PortfolioCostBasisSource.MANUAL);
  });

  it('overwrites vault_delivery with marketplace_buy seed', async () => {
    await service.seedVaultDeliveryCostBasis(WALLET, 13, 1000);
    await service.seedMarketplaceBuyCostBasis(WALLET, 13, 900);

    const row = rows.get(13);
    expect(row?.costBasisUsd).toBe(900);
    expect(row?.costBasisSource).toBe(PortfolioCostBasisSource.MARKETPLACE_BUY);
  });

  it('records vault mint acquisition without cost basis', async () => {
    const acquiredAt = new Date('2026-09-03T01:00:00.000Z');
    await service.recordVaultMintAcquisition(WALLET, 117, acquiredAt);

    const row = rows.get(117);
    expect(row?.acquiredAt?.toISOString()).toBe(acquiredAt.toISOString());
    expect(row?.costBasisUsd ?? null).toBeNull();
    expect(row?.costBasisSource ?? null).toBeNull();
  });

  it('falls back to rwa_tokens.created_at when holdings lack acquiredAt', async () => {
    const mintedAt = new Date('2026-09-03T02:00:00.000Z');
    registryCreatedAt.set('117', mintedAt);

    const batch = await service.getHoldingsBatch(WALLET, [117]);
    expect(batch).toEqual([
      {
        tokenId: 117,
        hidden: false,
        costBasisUsd: null,
        costBasisSource: null,
        acquiredAt: mintedAt.toISOString(),
      },
    ]);
  });

  it('unhide keeps acquisition-only rows', async () => {
    await service.recordVaultMintAcquisition(
      WALLET,
      118,
      new Date('2026-09-03T03:00:00.000Z'),
    );
    await service.hide(WALLET, 118);
    await service.unhide(WALLET, 118);

    expect(rows.get(118)?.acquiredAt).not.toBeNull();
    expect(rows.get(118)?.hiddenAt).toBeNull();
  });
});
