import { BadRequestException } from '@nestjs/common';
import {
  assertSlabImageAcceptableForOcr,
  PSA_SLAB_MAX_UPLOAD_BYTES,
} from './psa-slab-image.util';

describe('assertSlabImageAcceptableForOcr', () => {
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  it('accepts a small PNG', async () => {
    const meta = await assertSlabImageAcceptableForOcr(tinyPng);
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);
  });

  it('rejects file over 10MB before OCR', async () => {
    const huge = Buffer.alloc(PSA_SLAB_MAX_UPLOAD_BYTES + 1);
    await expect(assertSlabImageAcceptableForOcr(huge)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PSA_SLAB_IMAGE_TOO_LARGE',
      }),
    });
    await expect(assertSlabImageAcceptableForOcr(huge)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
