import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

/** Align with Cardhedger image endpoints (OpenAPI 413: max 10MB). */
export const PSA_SLAB_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Reject phone panoramas / huge camera RAW exports before sharp work. */
export const PSA_SLAB_MAX_EDGE_PX = 8_192;
export const PSA_SLAB_MAX_PIXELS = 20_000_000;

export const PSA_SLAB_IMAGE_TOO_LARGE_CODE = 'PSA_SLAB_IMAGE_TOO_LARGE';

export type SlabImageMeta = {
  width: number;
  height: number;
  bytes: number;
};

export async function readSlabImageMeta(
  image: Buffer,
): Promise<SlabImageMeta> {
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  return { width, height, bytes: image.length };
}

export function formatSlabSizeHint(meta: SlabImageMeta): string {
  const mp = ((meta.width * meta.height) / 1_000_000).toFixed(1);
  return `${meta.width}×${meta.height} (~${mp} MP), ${(meta.bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Fail fast with a user-actionable message (resize, re-export JPEG, or cert-only lookup).
 */
export async function assertSlabImageAcceptableForOcr(
  image: Buffer,
  label = 'slabFront',
): Promise<SlabImageMeta> {
  if (!image?.length) {
    throw new BadRequestException({
      statusCode: 400,
      code: PSA_SLAB_IMAGE_TOO_LARGE_CODE,
      message: `${label} image is empty.`,
    });
  }
  if (image.length > PSA_SLAB_MAX_UPLOAD_BYTES) {
    throw new BadRequestException({
      statusCode: 400,
      code: PSA_SLAB_IMAGE_TOO_LARGE_CODE,
      message:
        `Slab photo is too large (${(image.length / (1024 * 1024)).toFixed(1)} MB). ` +
        `Use JPEG/PNG/WebP under 10 MB — re-export from your camera roll or enter the PSA cert number instead.`,
    });
  }

  let meta: SlabImageMeta;
  try {
    meta = await readSlabImageMeta(image);
  } catch {
    throw new BadRequestException({
      statusCode: 400,
      code: PSA_SLAB_IMAGE_TOO_LARGE_CODE,
      message:
        'Could not read slab image. Use JPEG, PNG, or WebP (HEIC is not supported).',
    });
  }

  if (meta.width <= 0 || meta.height <= 0) {
    throw new BadRequestException({
      statusCode: 400,
      code: PSA_SLAB_IMAGE_TOO_LARGE_CODE,
      message: 'Slab image has invalid dimensions.',
    });
  }

  const pixels = meta.width * meta.height;
  if (
    meta.width > PSA_SLAB_MAX_EDGE_PX ||
    meta.height > PSA_SLAB_MAX_EDGE_PX ||
    pixels > PSA_SLAB_MAX_PIXELS
  ) {
    throw new BadRequestException({
      statusCode: 400,
      code: PSA_SLAB_IMAGE_TOO_LARGE_CODE,
      message:
        `Slab photo resolution is too high (${formatSlabSizeHint(meta)}). ` +
        `Crop to the graded slab label or use a photo under ${PSA_SLAB_MAX_EDGE_PX}px per side, ` +
        `or enter the cert number manually.`,
    });
  }

  return meta;
}
