import { VaultSubmissionService } from './vault-submission.service';
import { VaultSubmission } from './entities/vault-submission.entity';
import { VaultSubmissionItem } from './entities/vault-submission-item.entity';

describe('VaultSubmissionService.upsertDraft lock', () => {
  it('locks submission by publicId without relations (Postgres FOR UPDATE + LEFT JOIN)', async () => {
    const findOneCalls: unknown[] = [];
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

    const qb = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    const em = {
      findOne: jest.fn(async (_entity: unknown, opts: unknown) => {
        findOneCalls.push(opts);
        return existing;
      }),
      findOneOrFail: jest.fn(async () => ({
        ...existing,
        items: [],
      })),
      createQueryBuilder: jest.fn(() => qb),
      create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({
        ...data,
        id: 'item-1',
        createdAt: now,
        updatedAt: now,
      })),
      save: jest.fn(async (row: unknown) => row),
      delete: jest.fn(async () => undefined),
      update: jest.fn(async () => undefined),
    };

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
    );

    const dto = await service.upsertDraft('user-1', {
      publicId: 'sub-test-1',
      cards: [
        {
          cert: '12345678',
          name: 'Test Card',
          grade: 10,
          img: null,
          confirmed: true,
        },
      ],
    });

    expect(dto.publicId).toBe('SUB-TEST-1');
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
    // Final read may use relations — that path has no FOR UPDATE.
    expect(em.findOneOrFail).toHaveBeenCalledWith(VaultSubmission, {
      where: { id: 'sub-1' },
      relations: { items: true },
    });
  });
});
