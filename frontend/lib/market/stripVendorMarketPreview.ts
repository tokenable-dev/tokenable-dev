import type { CollectionMarketPreview } from "@/lib/core";

/** Hide vendor-specific preview messages (legacy snapshots + API). */
export function stripVendorMarketPreviewMessage(
  preview: CollectionMarketPreview | null | undefined,
): CollectionMarketPreview | null | undefined {
  if (!preview?.message?.trim()) return preview;
  const m = preview.message.trim();
  if (/cardhedger/i.test(m) || /no matching/i.test(m) || /card_id=/i.test(m)) {
    const { message: _omit, ...rest } = preview;
    return rest as CollectionMarketPreview;
  }
  return preview;
}

export function stripVendorFromMarketSeries<T extends { cardhedgerPreview?: CollectionMarketPreview | null }>(
  series: T,
): T {
  if (!series.cardhedgerPreview) return series;
  return {
    ...series,
    cardhedgerPreview: stripVendorMarketPreviewMessage(series.cardhedgerPreview) ?? null,
  };
}
