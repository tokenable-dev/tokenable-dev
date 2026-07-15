import {
  extractSumsubRejectionReason,
  mapSumsubReviewToKycStatus,
  shouldApplyKycTransition,
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
    expect(mapSumsubReviewToKycStatus('onHold', '')).toBe('pending');
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
});
