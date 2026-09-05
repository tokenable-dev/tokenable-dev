/**
 * PSA Public API `GetByCertNumber` / `GetImagesByCertNumber` 응답에서
 * 슬랩 앞·뒤 이미지 URL을 뽑는다 (필드명은 API 버전마다 다를 수 있음).
 *
 * 참고: `cert-images.psa.com` 호스트는 공개 DNS에서 더 이상 존재하지 않음(NXDOMAIN) —
 * 슬랩 사진은 `GetImagesByCertNumber`의 `ImageURL` + `IsFrontImage`를 사용한다.
 */

function isPsaCertImageUrlString(s: string): boolean {
  const t = s.trim();
  if (!/^https:\/\//i.test(t)) return false;
  return (
    /cert-images\.psa\.com/i.test(t) ||
    /cloudfront\.net/i.test(t) ||
    /(?:^|\.)psacard\.com/i.test(t)
  );
}

function getImagesRows(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    for (const k of ['Images', 'images', 'Data', 'data']) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
  }
  return null;
}

function coerceIsFrontImage(v: unknown): boolean | null {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  return null;
}

/** `GetImagesByCertNumber` JSON — 보통 `[{ ImageURL, IsFrontImage }, …]` */
export function extractPsaCertImagesFromGetImagesBody(body: unknown): {
  front?: string;
  back?: string;
} {
  const out: { front?: string; back?: string } = {};
  const rows = getImagesRows(body);
  if (!rows) return out;

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const u = (row as { ImageURL?: unknown }).ImageURL;
    const isFront = coerceIsFrontImage(
      (row as { IsFrontImage?: unknown }).IsFrontImage,
    );
    if (typeof u !== 'string' || !/^https?:\/\//i.test(u.trim())) continue;
    const url = u.trim();
    if (isFront === true) out.front = url;
    else if (isFront === false) out.back = url;
    else if (/_b\.(jpe?g|png)$/i.test(url)) out.back = url;
    else if (/_f\.(jpe?g|png)$/i.test(url)) out.front = url;
  }
  return out;
}

/** JSON 트리를 순회하며 PSA 슬랩 이미지 URL을 수집 (_f / _b 파일명 기준) */
function collectPsaCertImageUrlsFromUnknown(raw: unknown): {
  front?: string;
  back?: string;
} {
  const out: { front?: string; back?: string } = {};
  let visits = 0;
  const MAX_VISITS = 8000;
  const MAX_DEPTH = 48;

  const walk = (obj: unknown, depth: number): void => {
    if (depth > MAX_DEPTH) return;
    if (visits++ > MAX_VISITS) return;
    if (obj == null) return;
    if (typeof obj === 'string') {
      const s = obj.trim();
      if (!isPsaCertImageUrlString(s)) return;
      if (/_f\.(jpe?g|png)$/i.test(s)) out.front = s;
      else if (/_b\.(jpe?g|png)$/i.test(s)) out.back = s;
      return;
    }
    if (typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const v of obj) walk(v, depth + 1);
      return;
    }
    for (const v of Object.values(obj as Record<string, unknown>)) {
      walk(v, depth + 1);
    }
  };
  walk(raw, 0);
  return out;
}

/**
 * 성공한 PSA `GetByCertNumber` body + Cert 숫자로 앞면(민팅용)·뒷면 URL 후보를 만든다.
 * 응답에 없으면 빈 값 — 더 이상 존재하지 않는 cert-images.psa.com 규칙 URL은 만들지 않는다.
 */
export function extractPsaCertImageUrlsFromApiBody(
  apiBody: unknown,
  certDigits: string,
): { front?: string; back?: string } {
  const d = certDigits.replace(/\D/g, '');
  const out: { front?: string; back?: string } = {};
  if (d.length < 7) return out;

  const root = apiBody as {
    images?: { front?: unknown; back?: unknown };
    PSACert?: Record<string, unknown>;
  };

  if (root?.images && typeof root.images === 'object') {
    const f = root.images.front;
    const b = root.images.back;
    if (typeof f === 'string' && /^https?:\/\//i.test(f)) out.front = f.trim();
    if (typeof b === 'string' && /^https?:\/\//i.test(b)) out.back = b.trim();
  }

  const c = root.PSACert;
  if (c && typeof c === 'object') {
    for (const key of [
      'FrontImageUrl',
      'ImageUrl',
      'FrontImage',
      'CertImageUrl',
      'SlabImageUrl',
      'PrimaryImageUrl',
    ]) {
      const v = c[key];
      if (typeof v === 'string' && /^https?:\/\//i.test(v)) {
        out.front = v.trim();
        break;
      }
    }
    for (const key of ['BackImageUrl', 'BackImage', 'SecondaryImageUrl']) {
      const v = c[key];
      if (typeof v === 'string' && /^https?:\/\//i.test(v)) {
        out.back = v.trim();
        break;
      }
    }
  }

  const scanned = collectPsaCertImageUrlsFromUnknown(apiBody);
  if (!out.front && scanned.front) out.front = scanned.front;
  if (!out.back && scanned.back) out.back = scanned.back;

  return out;
}
