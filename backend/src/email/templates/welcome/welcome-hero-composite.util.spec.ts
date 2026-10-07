import sharp from 'sharp';
import { buildWelcomeHeroCompositePng } from './welcome-hero-composite.util';

describe('welcome-hero-composite.util', () => {
  it('builds a 600×330 PNG with wordmark and copy baked in', async () => {
    const buf = await buildWelcomeHeroCompositePng();
    expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(330);
    expect(buf.length).toBeGreaterThan(50_000);
  });
});
