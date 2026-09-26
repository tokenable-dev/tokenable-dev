import type { MarketCollectionPreview } from '../utils/market-reference.types';

/** Product UI must not name upstream pricing vendors or internal match failures. */
export function sanitizeUserMarketPreviewMessage(
  message: string | null | undefined,
): string | undefined {
  const m = String(message ?? '').trim();
  if (!m) return undefined;
  if (/cardhedger/i.test(m)) return undefined;
  if (/no matching/i.test(m)) return undefined;
  if (/card_id=/i.test(m)) return undefined;
  if (/CARDHEDGER_API_KEY/i.test(m)) return undefined;
  if (/comps payload/i.test(m)) return undefined;
  return m;
}

export function sanitizeMarketCollectionPreview(
  preview: MarketCollectionPreview,
): MarketCollectionPreview {
  const message = sanitizeUserMarketPreviewMessage(preview.message);
  if (message === preview.message) return preview;
  return { ...preview, message };
}
