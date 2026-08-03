import { VaultSubmissionService } from './vault-submission.service';

describe('VaultSubmissionService.markArrivedByCerts', () => {
  function makeService(opts: {
    items: Array<{
      certNumber: string;
      submission: { id: string; publicId: string; status: string };
    }>;
    markArrivedImpl?: (id: string) => Promise<unknown>;
  }) {
    const getMany = jest.fn().mockResolvedValue(opts.items);
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany,
    };
    const items = {
      createQueryBuilder: jest.fn(() => qb),
    };
    const submissions = {
      findOne: jest.fn(),
      save: jest.fn(),
      manager: {},
    };
    const service = new VaultSubmissionService(
      submissions as never,
      items as never,
      { findOne: jest.fn(), create: jest.fn(), save: jest.fn() } as never,
      { notifySellerSubmissionReceived: jest.fn() } as never,
    );
    service.adminMarkArrived = jest.fn(
      opts.markArrivedImpl ?? (async (id: string) => ({ id })),
    ) as never;
    return { service, qb, getMany };
  }

  it('marks each open package once for matched certs', async () => {
    const { service } = makeService({
      items: [
        {
          certNumber: '148872613',
          submission: {
            id: 'sub-1',
            publicId: 'SUB-A',
            status: 'in_transit',
          },
        },
        {
          certNumber: '999888777',
          submission: {
            id: 'sub-1',
            publicId: 'SUB-A',
            status: 'in_transit',
          },
        },
      ],
    });

    const r = await service.markArrivedByCerts([
      '148872613',
      '999888777',
      '0000000',
    ]);

    expect(r.matchedCerts.sort()).toEqual(['148872613', '999888777']);
    expect(r.unmatchedCerts).toEqual(['0000000']);
    expect(r.markedPublicIds).toEqual(['SUB-A']);
    expect(service.adminMarkArrived).toHaveBeenCalledTimes(1);
    expect(service.adminMarkArrived).toHaveBeenCalledWith('sub-1');
  });

  it('returns empty when no valid certs', async () => {
    const { service, getMany } = makeService({ items: [] });
    const r = await service.markArrivedByCerts(['abc', '']);
    expect(r).toEqual({
      matchedCerts: [],
      unmatchedCerts: [],
      markedPublicIds: [],
      skippedPublicIds: [],
    });
    expect(getMany).not.toHaveBeenCalled();
  });

  it('records skip when adminMarkArrived throws', async () => {
    const { service } = makeService({
      items: [
        {
          certNumber: '148872613',
          submission: {
            id: 'sub-2',
            publicId: 'SUB-B',
            status: 'in_transit',
          },
        },
      ],
      markArrivedImpl: async () => {
        throw new Error('already reviewing');
      },
    });
    const r = await service.markArrivedByCerts(['148872613']);
    expect(r.skippedPublicIds).toEqual(['SUB-B']);
    expect(r.markedPublicIds).toEqual([]);
  });
});
