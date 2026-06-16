import sharp from 'sharp';

/** Matches UI `aspect-[3/4]` hero frame. */
export const COLLECTION_COVER_CANVAS_WIDTH = 900;
export const COLLECTION_COVER_CANVAS_HEIGHT = 1200;

/** Collection hero inner background (`CollectionCoverFrame`). */
export const COLLECTION_COVER_BG = { r: 10, g: 14, b: 20, alpha: 1 };

/**
 * Fit source art inside a 3:4 canvas (object-contain), pad with hero background, emit JPEG.
 */
export async function normalizeCollectionCoverImage(
  input: Buffer,
): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 8 || h < 8) {
    throw new Error('COLLECTION_COVER_IMAGE_TOO_SMALL');
  }

  const canvasW = COLLECTION_COVER_CANVAS_WIDTH;
  const canvasH = COLLECTION_COVER_CANVAS_HEIGHT;

  const fitted = await sharp(input)
    .resize({
      width: canvasW,
      height: canvasH,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .toBuffer();

  const fittedMeta = await sharp(fitted).metadata();
  const fw = fittedMeta.width ?? canvasW;
  const fh = fittedMeta.height ?? canvasH;
  const left = Math.max(0, Math.floor((canvasW - fw) / 2));
  const top = Math.max(0, Math.floor((canvasH - fh) / 2));

  return sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: COLLECTION_COVER_BG,
    },
  })
    .composite([{ input: fitted, left, top }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}
