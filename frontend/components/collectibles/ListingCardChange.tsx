import type { ReferencePercentChangeDisplay } from "@/lib/market/priceChangePeriod";

export function listingCardChangeGlyph(
  display: Pick<ReferencePercentChangeDisplay, "showGlyph" | "tone">,
): string | undefined {
  if (!display.showGlyph) return undefined;
  return display.tone === "down" ? "\u25BC" : "\u25B2";
}

/** Listing-style % change chip — Markets, Watchlist, Home, Search, similar items. */
export function ListingCardChange({
  pctLabel,
  tone,
  glyph,
  period,
}: {
  pctLabel: string;
  tone: "up" | "down" | "muted" | "accent";
  glyph?: string;
  period?: string;
}) {
  return (
    <span className={`card__sub card__sub--${tone}`}>
      {glyph ? (
        <span className="card__sub-glyph" aria-hidden>{glyph}</span>
      ) : null}
      <span className="card__sub-pct">{pctLabel}</span>
      {period ? <span className="card__per">{period}</span> : null}
    </span>
  );
}
