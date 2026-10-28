import { ListingCardChange, listingCardChangeGlyph } from "@/components/collectibles/ListingCardChange";
import {
  formatListingMarketChangePeriod,
  resolveReferencePercentChangeDisplay,
} from "@/lib/market/priceChangePeriod";

export type ListingGradeCardChange = {
  pctLabel: string;
  period: string;
  tone: "up" | "down" | "muted" | "accent";
  glyph?: string;
};

/** Shared change line for listing grade cards. */
export function buildListingGradeCardChange(input: {
  changePct: number | null;
  changeLoading?: boolean;
  snapshot?: {
    marketChangeWindow?: string | null;
    marketChangeIsFullYear?: boolean;
  } | null;
  periodLabel?: string;
}): ListingGradeCardChange {
  if (input.changeLoading) {
    return { pctLabel: "…", period: "", tone: "muted" };
  }
  if (input.changePct == null || !Number.isFinite(input.changePct)) {
    return { pctLabel: "—", period: "", tone: "muted" };
  }
  const display = resolveReferencePercentChangeDisplay(input.changePct);
  const period =
    input.periodLabel?.trim() || formatListingMarketChangePeriod(input.snapshot);
  return {
    glyph: listingCardChangeGlyph(display),
    pctLabel: display.pctLabel,
    period: display.showGlyph ? period : "",
    tone: display.tone,
  };
}

/**
 * Listing grade card copy.
 * Line 1 `{Name} · {Number} · {Grade}`, line 2 price, line 3 ▲/▼ rate and period.
 */
export function ListingGradeCardLines({
  title,
  titleHover,
  priceLabel,
  change,
}: {
  title: string;
  titleHover?: string;
  priceLabel: string;
  change: ListingGradeCardChange;
}) {
  return (
    <>
      <div className="card__title" title={titleHover || title}>
        {title}
      </div>
      <div className="card__price">{priceLabel}</div>
      <ListingCardChange
        pctLabel={change.pctLabel}
        tone={change.tone}
        glyph={change.glyph}
        period={change.period}
      />
    </>
  );
}
