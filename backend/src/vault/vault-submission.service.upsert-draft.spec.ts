import { BadRequestException } from '@nestjs/common';
import { VaultSubmissionService } from './vault-submission.service';
import { VaultSubmission } from './entities/vault-submission.entity';
import { VaultSubmissionItem } from './entities/vault-submission-item.entity';

const CONFIRMED_CARD = {
  cert: '12345678',
  name: 'Test Card',
  grade: 10,
  img: null as string | null,
  confirmed: true,
};

function makeEm(opts: {
  findOneResult?: Record<string, unknown> | null;
  getOneResults?: Array<Record<string, unknown> | null>;
  /** Raw rows for nextDailyPublicId max lookup. */
  lastPublicIdRows?: Array<{ publicId: string }>;
  finalStatus?: string;
}) {
  const now = new Date();
  const findOneCalls: unknown[] = [];
  let getOneIdx = 0;
  const getOneResults = opts.getOneResults ?? [null];

  const qb = {
    setLock: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getOne: jest.fn(async () => {
      const v = getOneResults[Math.min(getOneIdx, getOneResults.length - 1)] ?? null;
      getOneIdx += 1;
      return v;
    }),
    getRawMany: jest.fn(async () => opts.lastPublicIdRows ?? []),
  };

  const createdRows: Record<string, unknown>[] = [];
  const updates: unknown[] = [];

  const em = {
    query: jest.fn(async () => undefined),
    findOne: jest.fn(async (_entity: unknown, findOpts: unknown) => {
      findOneCalls.push(findOpts);
      return opts.findOneResult ?? null;
    }),
    findOneOrFail: jest.fn(async () => {
      const base =
        opts.findOneResult ??
        createdRows[0] ??
        ({
          id: 'sub-new',
          publicId: 'SUB-NEW',
          userId: 'user-1',
          status: opts.finalStatus ?? 'awaiting_shipment',
          carrier: null,
          trackingNumber: null,
          shipDate: null,
          shippedAt: null,
          packingSlipDownloadedAt: null,
          createdAt: now,
          updatedAt: now,
        } as Record<string, unknown>);
      return {
        ...base,
        status: opts.finalStatus ?? 'awaiting_shipment',
        items: [
          {
            id: 'item-1',
            submissionId: String(base.id),
            certNumber: '12345678',
            displayName: 'Test Card',
            grade: 'PSA 10',
            imageUrl: null,
            status: 'confirmed',
            rejectionReason: null,
            vaultCycleId: null,
            sortOrder: 0,
            createdAt: now,
            updatedAt: now,
          },
        ],
      };
    }),
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => {
      const row = {
        ...data,
        id: data.id ?? `gen-${createdRows.length + 1}`,
        createdAt: now,
        updatedAt: now,
      };
      createdRows.push(row);
      return row;
    }),
    save: jest.fn(async (row: unknown) => row),
    delete: jest.fn(async () => undefined),
    update: jest.fn(async (...args: unknown[]) => {
      updates.push(args);
      return undefined;
    }),
  };

  return { em, findOneCalls, qb, updates, createdRows };
}

describe('VaultSubmissionService.upsertDraft', () => {
  it('locks submission by publicId without relations (Postgres FOR UPDATE + LEFT JOIN)', async () => {
    const now = new Date();
    const existing = {
      id: 'sub-1',
      publicId: 'SUB-TEST-1',
      userId: 'user-1',
      status: 'draft' as const,
      carrier: null,
      trackingNumber: null,
      shipDate: null,
      shippedAt: null,
      packingSlipDownloadedAt: null,
      createdAt: now,
      updatedAt: now,
      items: [] as unknown[],
    };
    const { em, findOneCalls } = makeEm({
      findOneResult: existing,
      finalStatus: 'awaiting_shipment',
    });

    const submissions = {
      manager: {
        transaction: async (fn: (e: typeof em) => Promise<unknown>) => fn(em),
      },
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const service = new VaultSubmissionService(
      submissions as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const dto = await service.upsertDraft('user-1', {
      publicId: 'sub-test-1',
      cards: [CONFIRMED_CARD],
    });

    expect(dto.publicId).toBe('SUB-TEST-1');
    expect(dto.status).toBe('awaiting_shipment');
    expect(em.findOne).toHaveBeenCalled();
    const lockCall = findOneCalls[0] as {
      relations?: unknown;
      lock?: { mode: string };
      where: { publicId: string; userId: string };
    };
    expect(lockCall.lock).toEqual({ mode: 'pessimistic_write' });
    expect(lockCall.relations).toBeUndefined();
    expect(lockCall.where.publicId).toBe('SUB-TEST-1');
    expect(em.delete).toHaveBeenCalledWith(VaultSubmissionItem, {
      submissionId: 'sub-1',
    });
    expect(em.update).toHaveBeenCalledWith(
      VaultSubmission,
      { id: 'sub-1' },
      { status: 'awaiting_shipment' },
    );
    expect(em.findOneOrFail).toHaveBeenCalledWith(VaultSubmission, {
      where: { id: 'sub-1' },
      relations: { items: true },
    });
  });

  it('creates a new package as awaiting_shipment (never draft)', async () => {
    const { em, createdRows, qb, updates } = makeEm({
      findOneResult: null,
      getOneResults: [null, null],
      finalStatus: 'awaiting_shipment',
    });

    const submissions = {
      manager: {
        transaction: async (fn: (e: typeof em) => Promise<unknown>) => fn(em),
      },
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const service = new VaultSubmissionService(
      submissions as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const dto = await service.upsertDraft('user-1', {
      cards: [CONFIRMED_CARD],
    });

    expect(dto.status).toBe('awaiting_shipment');
    expect(em.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1)',
      [expect.any(Number)],
    );
    expect(em.createQueryBuilder).toHaveBeenCalled();
    expect(qb.andWhere).toHaveBeenCalledWith("s.status = 'awaiting_shipment'");
    expect(qb.andWhere).toHaveBeenCalledWith("s.status = 'draft'");
    const packageCreate = createdRows.find(
      (r) => typeof r.publicId === 'string' && String(r.publicId).startsWith('SUB-'),
    );
    expect(packageCreate).toBeTruthy();
    expect(packageCreate?.status).toBe('awaiting_shipment');
    expect(String(packageCreate?.publicId)).toMatch(/^SUB-\d{8}-00001$/);
    expect(updates.some((u) => JSON.stringify(u).includes('awaiting_shipment'))).toBe(
      true,
    );
  });

  it('sequences public ids per day (00002 after 00001)', async () => {
    const service = new VaultSubmissionService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const fixed = new Date(2026, 7, 5); // local Aug 5, 2026
    const { em } = makeEm({
      lastPublicIdRows: [{ publicId: 'SUB-20260805-00001' }],
    });
    await expect(service.nextDailyPublicId(em as never, fixed)).resolves.toBe(
      'SUB-20260805-00002',
    );
  });

  it('starts at 00001 when no packages exist that day', async () => {
    const service = new VaultSubmissionService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const fixed = new Date(2026, 7, 5);
    const { em } = makeEm({ lastPublicIdRows: [] });
    await expect(service.nextDailyPublicId(em as never, fixed)).resolves.toBe(
      'SUB-20260805-00001',
    );
  });

  it('rejects empty card list with a clear BadRequest', async () => {
    const submissions = {
      manager: { transaction: jest.fn() },
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const service = new VaultSubmissionService(
      submissions as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.upsertDraft('user-1', { cards: [] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(submissions.manager.transaction).not.toHaveBeenCalled();
  });

  it('rejects unconfirmed cards (no draft package write)', async () => {
    const submissions = {
      manager: { transaction: jest.fn() },
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const service = new VaultSubmissionService(
      submissions as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.upsertDraft('user-1', {
        cards: [{ ...CONFIRMED_CARD, confirmed: false }],
      }),
    ).rejects.toThrow(/Confirm every card/);
    expect(submissions.manager.transaction).not.toHaveBeenCalled();
  });

  it('prefers existing awaiting_shipment over legacy draft when no publicId', async () => {
    const now = new Date();
    const openShip = {
      id: 'sub-ship',
      publicId: 'SUB-SHIP',
      userId: 'user-1',
      status: 'awaiting_shipment' as const,
      carrier: null,
      trackingNumber: null,
      shipDate: null,
      shippedAt: null,
      packingSlipDownloadedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const { em, qb } = makeEm({
      findOneResult: null,
      getOneResults: [openShip],
      finalStatus: 'awaiting_shipment',
    });
    // findOneOrFail should return this package
    em.findOneOrFail = jest.fn(async () => ({
      ...openShip,
      items: [
        {
          id: 'item-1',
          submissionId: 'sub-ship',
          certNumber: '12345678',
          displayName: 'Test Card',
          grade: 'PSA 10',
          imageUrl: null,
          status: 'confirmed',
          rejectionReason: null,
          vaultCycleId: null,
          sortOrder: 0,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));

    const submissions = {
      manager: {
        transaction: async (fn: (e: typeof em) => Promise<unknown>) => fn(em),
      },
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const service = new VaultSubmissionService(
      submissions as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const dto = await service.upsertDraft('user-1', { cards: [CONFIRMED_CARD] });
    expect(dto.publicId).toBe('SUB-SHIP');
    expect(dto.status).toBe('awaiting_shipment');
    // Only one getOne — awaiting_shipment hit; draft fallback not needed.
    expect(qb.getOne).toHaveBeenCalledTimes(1);
  });
});
