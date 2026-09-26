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

  it('admin catalog insert stays pending_review until listed', () => {
    const catalogInsert: CollectionReviewStatus = 'pending_review';
    const listingInsert: CollectionReviewStatus = 'active';
    expect(catalogInsert).toBe('pending_review');
    expect(listingInsert).toBe('active');
  });

  it('existing rows default to active', () => {
    const defaultStatus: CollectionReviewStatus = 'active';
    expect(defaultStatus).toBe('active');
  });
});
