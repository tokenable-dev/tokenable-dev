import {
  extractSumsubRejectionReason,
  mapSumsubReviewToKycStatus,
  parseSumsubApplicant,
  resolveKycStatusFromSumsubApplicant,
  shouldApplyKycTransition,
  shouldApplyReconcileTransition,
} from './sumsub-status.util';

describe('sumsub-status.util', () => {
  it('maps completed GREEN to approved', () => {
    expect(mapSumsubReviewToKycStatus('completed', 'GREEN')).toBe('approved');
  });

  it('maps completed RED to rejected', () => {
    expect(mapSumsubReviewToKycStatus('completed', 'RED')).toBe('rejected');
  });

  it('maps in-progress review to pending', () => {
    expect(mapSumsubReviewToKycStatus('pending', '')).toBe('pending');
    expect(mapSumsubReviewToKycStatus('prechecked', '')).toBe('pending');
    expect(mapSumsubReviewToKycStatus('onHold', '')).toBe('pending');
  });

  it('maps init / empty review to none (SDK opened, not submitted)', () => {
    expect(mapSumsubReviewToKycStatus('init', '')).toBe('none');
    expect(mapSumsubReviewToKycStatus('', '')).toBe('none');
    expect(
      resolveKycStatusFromSumsubApplicant({
        id: 'app-init',
        reviewStatus: 'init',
        reviewAnswer: '',
      }),
    ).toBe('none');
  });

  it('skips downgrade from approved to pending', () => {
    expect(shouldApplyKycTransition('approved', 'pending')).toBe(false);
    expect(shouldApplyKycTransition('approved', 'rejected')).toBe(true);
  });

  it('extracts rejection labels', () => {
    expect(
      extractSumsubRejectionReason({
        rejectLabels: ['UNSATISFACTORY_PHOTOS', 'FORGERY'],
      }),
    ).toBe('UNSATISFACTORY_PHOTOS, FORGERY');
  });

  it('reconcile allows downgrade from stale approved', () => {
    expect(shouldApplyReconcileTransition('approved', 'none')).toBe(true);
    expect(shouldApplyReconcileTransition('approved', 'pending')).toBe(true);
  });

  it('parses applicant review snapshot', () => {
    const snapshot = parseSumsubApplicant({
      id: 'app-1',
      review: {
        reviewStatus: 'completed',
        reviewResult: { reviewAnswer: 'GREEN' },
      },
    });
    expect(snapshot?.id).toBe('app-1');
    expect(resolveKycStatusFromSumsubApplicant(snapshot)).toBe('approved');
  });

  it('maps missing applicant to none', () => {
    expect(resolveKycStatusFromSumsubApplicant(null)).toBe('none');
  });
});
