/** Parse a USD amount from PSA estimate strings (`$415.00`, `415`, etc.). */
export function parsePsaEstimateUsdFromText(raw: string | null | undefined): number | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const cleaned = s.replace(/,/g, '').replace(/\$/g, '').trim();
  const m = cleaned.match(/(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Extract PSA Estimate USD from cert page visible text.
 * Matches layouts like `PSA Estimate` followed by `$415.00`.
 */
export function parsePsaEstimateUsdFromPageText(text: string): number | null {
  const t = String(text ?? '');
  if (!t.trim()) return null;

  const labeled = t.match(
    /PSA\s+Estimate[\s\S]{0,120}?\$\s*([\d,]+(?:\.\d{1,2})?)/i,
  );
  if (labeled) {
    const n = parsePsaEstimateUsdFromText(labeled[1]);
    if (n != null) return n;
  }

  const reverse = t.match(
    /\$\s*([\d,]+(?:\.\d{1,2})?)[\s\S]{0,80}?PSA\s+Estimate/i,
  );
  if (reverse) {
    const n = parsePsaEstimateUsdFromText(reverse[1]);
    if (n != null) return n;
  }

  return null;
}

/** Walk JSON payloads (Next.js `__NEXT_DATA__`, XHR bodies) for estimate fields. */
export function parsePsaEstimateUsdFromJson(root: unknown): number | null {
  let found: number | null = null;

  const visit = (node: unknown, keyHint = '', depth = 0) => {
    if (found != null || depth > 14 || node == null) return;

    const hint = keyHint.toLowerCase();

    if (typeof node === 'number') {
      if (hint.includes('estimate') && node > 0 && Number.isFinite(node)) {
        found = node;
      }
      return;
    }

    if (typeof node === 'string') {
      if (hint.includes('estimate')) {
        const n = parsePsaEstimateUsdFromText(node);
        if (n != null) found = n;
      }
      return;
    }

    if (typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const item of node) visit(item, keyHint, depth + 1);
      return;
    }

    const o = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      if (found != null) return;
      const childHint = keyHint ? `${keyHint}.${k}` : k;
      const kLower = k.toLowerCase();
      if (
        kLower.includes('estimate') ||
        kLower === 'psaestimate' ||
        kLower === 'psa_estimate'
      ) {
        const direct =
          typeof v === 'number'
            ? v
            : typeof v === 'string'
              ? parsePsaEstimateUsdFromText(v)
              : typeof v === 'object' && v != null
                ? parsePsaEstimateUsdFromJson(v)
                : null;
        if (direct != null && Number.isFinite(direct) && direct > 0) {
          found = direct;
          return;
        }
      }
      visit(v, childHint, depth + 1);
    }
  };

  visit(root);
  return found;
}

export function parsePsaEstimateUsdFromHtml(html: string): number | null {
  const raw = String(html ?? '');
  if (!raw.trim()) return null;

  const fromText = parsePsaEstimateUsdFromPageText(
    raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  );
  if (fromText != null) return fromText;

  const nextData = raw.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (nextData?.[1]) {
    try {
      const parsed = parsePsaEstimateUsdFromJson(JSON.parse(nextData[1]));
      if (parsed != null) return parsed;
    } catch {
      /* ignore */
    }
  }

  const jsonLdBlocks = raw.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of jsonLdBlocks) {
    try {
      const parsed = parsePsaEstimateUsdFromJson(JSON.parse(block[1] ?? ''));
      if (parsed != null) return parsed;
    } catch {
      /* ignore */
    }
  }

  return null;
}
