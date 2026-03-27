/**
 * PSA Public API `GetByCertNumber` 응답 및 cert-images.psa.com 규칙에서
 * 슬랩 앞·뒤 이미지 URL을 뽑는다 (필드명은 API 버전마다 다를 수 있음).
 */

export function buildPsaCertImageFallbackUrls(certDigits: string): {
  front: string;
  back: string;
} {
  const d = certDigits.replace(/\D/g, '');
  const base = `https://cert-images.psa.com/${d}/large`;
  return {
    front: `${base}/${d}_f.jpg`,
    back: `${base}/${d}_b.jpg`,
  };
}

/** JSON 트리를 순회하며 cert-images.psa.com URL을 수집 (_f / _b 파일명 기준) */
function collectPsaCertImageUrlsFromUnknown(raw: unknown): {
  front?: string;
  back?: string;
} {
  const out: { front?: string; back?: string } = {};
  const walk = (obj: unknown): void => {
    if (obj == null) return;
    if (typeof obj === 'string') {
      const s = obj.trim();
      if (!/^https:\/\/cert-images\.psa\.com\//i.test(s)) return;
      if (/_f\.(jpe?g|png)$/i.test(s)) out.front = s;
      else if (/_b\.(jpe?g|png)$/i.test(s)) out.back = s;
      return;
    }
    if (typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const v of obj) walk(v);
      return;
    }
    for (const v of Object.values(obj)) walk(v);
  };
  walk(raw);
  return out;
}

/**
 * 성공한 PSA API body + Cert 숫자로 앞면(민팅용)·뒷면 URL 후보를 만든다.
 * 응답에 없으면 cert-images.psa.com 규칙 URL을 채운다 (존재 여부는 호출부에서 probe).
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

  if (!out.front) {
    const fb = buildPsaCertImageFallbackUrls(d);
    out.front = fb.front;
    out.back = fb.back;
  }

  return out;
}
