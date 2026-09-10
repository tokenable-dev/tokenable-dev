import { CollectionCoverService } from './collection-cover.service';

describe('CollectionCoverService.upgradeCoverFromMetaIfBetter preserve', () => {
  const existing = 'https://cdn.example.com/covers/abc/cover';

  it('does not replace an existing cover on the listing/sale path', async () => {
    const findOne = jest.fn().mockResolvedValue({
      collectionKey: 'abc',
      coverImageUrl: existing,
    });
    const update = jest.fn().mockResolvedValue(undefined);
    const catalogCoverS3 = {
      isConfigured: jest.fn().mockReturnValue(true),
      getPublicBaseUrl: jest.fn().mockReturnValue('https://cdn.example.com'),
      ingestBestRemoteImage: jest.fn(),
      downloadRemoteImage: jest.fn(),
    };
    const svc = new CollectionCoverService(
      { findOne, update } as never,
      {} as never,
      { assertConfigured: jest.fn(), forwardJson: jest.fn() } as never,
      {} as never,
      catalogCoverS3 as never,
    );

    const out = await svc.upgradeCoverFromMetaIfBetter('abc', {
      properties: {
        graded: { cardhedger: { imageUrl: 'https://cdn.bubble.io/x/crop_image' } },
      },
    });

    expect(out).toBe(existing);
    expect(update).not.toHaveBeenCalled();
    expect(catalogCoverS3.ingestBestRemoteImage).not.toHaveBeenCalled();
    expect(catalogCoverS3.downloadRemoteImage).not.toHaveBeenCalled();
  });
});
