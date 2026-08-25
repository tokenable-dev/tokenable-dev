"use client";

/** Card.html listings section header above `#ask-notch`. */
export function CollectionListingsSectionHeader({
  compact = false,
  activeCount,
  highestBidUsd,
  bidCount,
}: {
  compact?: boolean;
  activeCount?: number;
  highestBidUsd?: number | null;
  bidCount?: number;
}) {
  const asksLabel =
    activeCount != null
      ? `${activeCount} ask${activeCount === 1 ? "" : "s"} · lowest first`
      : null;

  const bidLine =
    bidCount != null && bidCount > 0
      ? `${bidCount} buyer${bidCount === 1 ? "" : "s"} want this${
          highestBidUsd != null && highestBidUsd > 0
            ? ` · highest bid $${highestBidUsd.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}`
            : ""
        }`
      : null;

  return (
    <header
      className={
        compact
          ? "cd-listings-header cd-listings-header--mobile"
          : "cd-listings-header"
      }
      aria-labelledby="collection-listings-heading"
    >
      <div className="cd-listings-header__copy">
        <h2 id="collection-listings-heading" className="cd-listings-header__title">
          Listings{" "}
          <span className="cd-listings-header__asks-label">(asks)</span>
        </h2>
        <p className="cd-listings-header__sub">
          Pick a specific copy to buy — vault and cert shown. Buy now takes the
          lowest ask; if several share that price, you choose which card.
        </p>
        {bidLine ? (
          <div className="cd-listings-header__interest mono">
            <span className="cd-listings-header__interest-dot" aria-hidden />
            {bidLine}
          </div>
        ) : null}
      </div>
      {asksLabel ? (
        <span className="cd-listings-header__count">{asksLabel}</span>
      ) : null}
    </header>
  );
}
