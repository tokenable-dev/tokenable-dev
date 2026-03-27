import sharp from 'sharp';

export interface PsaSlabCropOptions {
  /** 상단 PSA 라벨 제거 (높이 비율, 0~0.6 미만) */
  topTrimRatio: number;
  /** 좌·우 슬랩 프레임: 각각 너비의 이 비율만큼 잘라냄 (0~0.25 권장) */
  sideInsetRatio: number;
  /** 하단 슬랩 프레임: 높이의 이 비율만큼 잘라냄 (0~0.35 권장) */
  bottomInsetRatio: number;
}

async function cropTopStrip(buffer: Buffer, topTrimRatio: number): Promise<Buffer> {
  if (!Number.isFinite(topTrimRatio) || topTrimRatio < 0 || topTrimRatio >= 0.6) {
    throw new Error('topTrimRatio must be in [0, 0.6)');
  }
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 48 || h < 48) {
    throw new Error('Image too small for slab crop');
  }
  const topPx = Math.min(Math.max(0, Math.round(h * topTrimRatio)), h - 32);
  const height = h - topPx;
  if (height < 32) {
    throw new Error('Crop would remove too much of the image');
  }
  return sharp(buffer)
    .extract({ left: 0, top: topPx, width: w, height })
    .png()
    .toBuffer();
}

/**
 * 상단 라벨 제거 후 이미지에서 좌·우·하단 플라스틱 프레임(베젤)을 비율로 잘라 카드 영역만 남긴다.
 */
async function cropSlabFrameInsets(
  buffer: Buffer,
  sideInsetRatio: number,
  bottomInsetRatio: number,
): Promise<Buffer> {
  if (!Number.isFinite(sideInsetRatio) || sideInsetRatio < 0 || sideInsetRatio >= 0.35) {
    throw new Error('sideInsetRatio must be in [0, 0.35)');
  }
  if (!Number.isFinite(bottomInsetRatio) || bottomInsetRatio < 0 || bottomInsetRatio >= 0.45) {
    throw new Error('bottomInsetRatio must be in [0, 0.45)');
  }
  const meta = await sharp(buffer).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (W < 32 || H < 32) {
    throw new Error('Image too small for frame inset');
  }
  const sidePx = Math.round(W * sideInsetRatio);
  const bottomPx = Math.round(H * bottomInsetRatio);
  const w2 = W - 2 * sidePx;
  const h2 = H - bottomPx;
  if (w2 < 32 || h2 < 32) {
    throw new Error('Frame inset would remove too much of the image');
  }
  return sharp(buffer)
    .extract({ left: sidePx, top: 0, width: w2, height: h2 })
    .png()
    .toBuffer();
}

/**
 * PSA 슬랩 정면 사진 → 컬렉션 대표용: 상단 라벨 제거 + 좌·우·하단 프레임(베젤) 축소.
 */
export async function cropPsaSlabForCollectionCover(
  buffer: Buffer,
  opts: PsaSlabCropOptions,
): Promise<Buffer> {
  const afterTop = await cropTopStrip(buffer, opts.topTrimRatio);
  return cropSlabFrameInsets(afterTop, opts.sideInsetRatio, opts.bottomInsetRatio);
}

/** @deprecated 내부 단계용 — `cropPsaSlabForCollectionCover` 사용 권장 */
export async function cropPsaSlabTopForCardRegion(
  buffer: Buffer,
  topTrimRatio: number,
): Promise<Buffer> {
  return cropTopStrip(buffer, topTrimRatio);
}
