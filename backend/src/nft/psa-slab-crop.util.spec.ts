import sharp from 'sharp';
import { cropPsaSlabForCollectionCover } from './psa-slab-crop.util';

describe('cropPsaSlabForCollectionCover', () => {
  it('removes the top strip when side/bottom insets are zero', async () => {
    const buf = await sharp({
      create: {
        width: 100,
        height: 200,
        channels: 3,
        background: { r: 200, g: 10, b: 10 },
      },
    })
      .png()
      .toBuffer();

    const out = await cropPsaSlabForCollectionCover(buf, {
      topTrimRatio: 0.25,
      sideInsetRatio: 0,
      bottomInsetRatio: 0,
    });
    const m = await sharp(out).metadata();
    expect(m.width).toBe(100);
    expect(m.height).toBe(150);
  });

  it('throws when topTrimRatio is invalid', async () => {
    const buf = Buffer.alloc(100);
    await expect(
      cropPsaSlabForCollectionCover(buf, {
        topTrimRatio: 0.7,
        sideInsetRatio: 0,
        bottomInsetRatio: 0,
      }),
    ).rejects.toThrow();
  });

  it('applies top trim then side and bottom frame insets', async () => {
    const buf = await sharp({
      create: {
        width: 100,
        height: 200,
        channels: 3,
        background: { r: 50, g: 50, b: 200 },
      },
    })
      .png()
      .toBuffer();

    const out = await cropPsaSlabForCollectionCover(buf, {
      topTrimRatio: 0.25,
      sideInsetRatio: 0.1,
      bottomInsetRatio: 0.2,
    });
    const m = await sharp(out).metadata();
    // 200 * 0.75 = 150 height after top; width 100 - 20 = 80; height 150 - 30 = 120
    expect(m.width).toBe(80);
    expect(m.height).toBe(120);
  });
});
