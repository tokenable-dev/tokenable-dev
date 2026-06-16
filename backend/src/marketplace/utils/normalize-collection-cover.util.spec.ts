import sharp from 'sharp';
import {
  COLLECTION_COVER_CANVAS_HEIGHT,
  COLLECTION_COVER_CANVAS_WIDTH,
  normalizeCollectionCoverImage,
} from './normalize-collection-cover.util';

describe('normalizeCollectionCoverImage', () => {
  it('outputs a 3:4 JPEG canvas with centered art', async () => {
    const wide = await sharp({
      create: {
        width: 400,
        height: 200,
        channels: 3,
        background: { r: 200, g: 50, b: 50 },
      },
    })
      .png()
      .toBuffer();

    const out = await normalizeCollectionCoverImage(wide);
    const meta = await sharp(out).metadata();

    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(COLLECTION_COVER_CANVAS_WIDTH);
    expect(meta.height).toBe(COLLECTION_COVER_CANVAS_HEIGHT);
    expect(out.byteLength).toBeGreaterThan(1_000);
  });

  it('rejects images that are too small', async () => {
    const tiny = await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    await expect(normalizeCollectionCoverImage(tiny)).rejects.toThrow(
      'COLLECTION_COVER_IMAGE_TOO_SMALL',
    );
  });
});
