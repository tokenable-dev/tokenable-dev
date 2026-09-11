/** Known marketplace host patterns → display label (inferred from Cardhedger `sale_url`). */
const SALE_URL_PLATFORM_RULES: ReadonlyArray<{ test: (host: string) => boolean; label: string }> =
  [
    { test: (h) => h.includes('ebay.'), label: 'eBay' },
    { test: (h) => h.includes('comc.com'), label: 'COMC' },
    { test: (h) => h.includes('pwcc'), label: 'PWCC' },
    { test: (h) => h.includes('goldin'), label: 'Goldin' },
    { test: (h) => h.includes('heritage'), label: 'Heritage' },
    { test: (h) => h.includes('myslabs'), label: 'MySlabs' },
    { test: (h) => h.includes('alt.xyz') || h.includes('onlyalt'), label: 'Alt' },
    { test: (h) => h.includes('fanatics'), label: 'Fanatics' },
    { test: (h) => h.includes('starstock'), label: 'StarStock' },
  ];

function labelFromHostname(host: string): string | null {
  const h = host.toLowerCase().replace(/^www\./, '');
  for (const rule of SALE_URL_PLATFORM_RULES) {
    if (rule.test(h)) return rule.label;
  }
  const stem = h.split('.')[0]?.trim();
  if (!stem || stem.length < 2) return null;
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

function labelFromPriceSource(priceSource: string): string | null {
  const src = priceSource.trim().toLowerCase();
  if (!src || src === 'marketplace') return null;
  if (src.includes('ebay')) return 'eBay';
  return src
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Infer display marketplace from Cardhedger comps `raw_prices` fields.
 * Upstream has no dedicated platform column — `sale_url` host is the primary signal.
 */
export function inferExternalSalePlatform(input: {
  saleUrl?: string | null;
  priceSource?: string | null;
}): string | null {
  const url = typeof input.saleUrl === 'string' ? input.saleUrl.trim() : '';
  if (url) {
    try {
      const host = new URL(url).hostname;
      const fromHost = labelFromHostname(host);
      if (fromHost) return fromHost;
    } catch {
      /* ignore malformed url */
    }
  }

  const priceSource =
    typeof input.priceSource === 'string' ? input.priceSource.trim() : '';
  if (priceSource) {
    const fromSource = labelFromPriceSource(priceSource);
    if (fromSource) return fromSource;
  }

  return null;
}
