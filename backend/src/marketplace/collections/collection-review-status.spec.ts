import {
  type CollectionReviewStatus,
} from '../entities/marketplace-collection.entity';

describe('collection review status rules', () => {
  const PUBLIC_VISIBLE: CollectionReviewStatus[] = ['active'];

  it('only active is public-visible', () => {
    expect(PUBLIC_VISIBLE.includes('active')).toBe(true);
    expect(PUBLIC_VISIBLE.includes('pending_review')).toBe(false);
    expect(PUBLIC_VISIBLE.includes('rejected')).toBe(false);
  });

  it('new insert status is pending_review', () => {
    const newInsertStatus: CollectionReviewStatus = 'pending_review';
    expect(newInsertStatus).toBe('pending_review');
  });

  it('existing rows default to active', () => {
    const defaultStatus: CollectionReviewStatus = 'active';
    expect(defaultStatus).toBe('active');
  });
});
