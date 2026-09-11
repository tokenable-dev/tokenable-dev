import { VaultSubmissionService } from './vault-submission.service';
import type { VaultPsaArrivalReview } from './entities/vault-psa-arrival-review.entity';

describe('VaultSubmissionService.maybeAutoConfirmPsaArrivalReview', () => {
  const reviewId = 'rev-1';

  function makeReview(
    overrides: Partial<VaultPsaArrivalReview> = {},
  ): VaultPsaArrivalReview {
    return {
      id: reviewId,
      gmailMessageId: 'msg-1',
      subject: 'Items Received at PSA Vault',
      fromAddress: 'noreply@collectors.com',
      certs: ['148872613'],
      matchedPublicIds: ['SUB-A'],
      unmatchedCerts: [],
      ingestNote: null,
      status: 'pending',
      confirmedVia: null,
      skippedPublicIds: [],
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  function makeService(opts: {
    review?: VaultPsaArrivalReview | null;
    markArrivedImpl?: (id: string) => Promise<unknown>;
  }) {
    let savedReview: VaultPsaArrivalReview | null = opts.review ?? null;
    const arrivalReviews = {
      findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === reviewId ? savedReview : null,
      ),
      save: jest.fn(async (row: VaultPsaArrivalReview) => {
        savedReview = row;
        return row;
      }),
    };
    const service = new VaultSubmissionService(
      { findOne: jest.fn(), save: jest.fn(), manager: { query: jest.fn() } } as never,
      { createQueryBuilder: jest.fn() } as never,
      arrivalReviews as never,
      { findOne: jest.fn(), create: jest.fn(), save: jest.fn() } as never,
      { notifySellerSubmissionReceived: jest.fn() } as never,
    );
    service.findOpenPackagesByCerts = jest.fn(async () => ({
      matchedCerts: ['148872613'],
      unmatchedCerts: [],
      packages: [
        {
          id: 'sub-1',
          publicId: 'SUB-A',
          userId: 'u1',
          status: 'in_transit',
          certs: ['148872613'],
        },
      ],
    })) as never;
    service.adminMarkArrived = jest.fn(
      opts.markArrivedImpl ?? (async () => ({ id: 'sub-1' })),
    ) as never;
    service['getArrivalReviewDto'] = jest.fn(async () => ({ id: reviewId })) as never;
    return { service, getSaved: () => savedReview };
  }

  const prevAuto = process.env.PSA_RECEIVED_MAIL_AUTO_CONFIRM;

  afterEach(() => {
    if (prevAuto === undefined) delete process.env.PSA_RECEIVED_MAIL_AUTO_CONFIRM;
    else process.env.PSA_RECEIVED_MAIL_AUTO_CONFIRM = prevAuto;
  });

  it('auto-confirms pending review with open packages', async () => {
    process.env.PSA_RECEIVED_MAIL_AUTO_CONFIRM = '1';
    const { service, getSaved } = makeService({ review: makeReview() });

    const r = await service.maybeAutoConfirmPsaArrivalReview(reviewId);

    expect(r).toEqual({ confirmed: true });
    expect(service.adminMarkArrived).toHaveBeenCalledWith('sub-1');
    expect(getSaved()?.status).toBe('confirmed');
    expect(getSaved()?.confirmedVia).toBe('auto');
  });

  it('stays pending when auto confirm is disabled', async () => {
    process.env.PSA_RECEIVED_MAIL_AUTO_CONFIRM = '0';
    const { service, getSaved } = makeService({ review: makeReview() });

    const r = await service.maybeAutoConfirmPsaArrivalReview(reviewId);

    expect(r).toEqual({ confirmed: false, reason: 'auto_confirm_disabled' });
    expect(service.adminMarkArrived).not.toHaveBeenCalled();
    expect(getSaved()?.status).toBe('pending');
  });

  it('stays pending when ingest note is set', async () => {
    const { service, getSaved } = makeService({
      review: makeReview({ ingestNote: 'no_certs' }),
    });

    const r = await service.maybeAutoConfirmPsaArrivalReview(reviewId);

    expect(r).toEqual({ confirmed: false, reason: 'ingest_incomplete' });
    expect(getSaved()?.status).toBe('pending');
  });

  it('stays pending when mark arrived fails for all packages', async () => {
    const { service, getSaved } = makeService({
      review: makeReview(),
      markArrivedImpl: async () => {
        throw new Error('already reviewing');
      },
    });

    const r = await service.maybeAutoConfirmPsaArrivalReview(reviewId);

    expect(r).toEqual({ confirmed: false, reason: 'apply_failed' });
    expect(getSaved()?.status).toBe('pending');
  });
});
