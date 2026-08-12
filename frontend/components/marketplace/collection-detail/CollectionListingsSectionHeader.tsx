"use client";

/** Section break between chart and listing rows (Card.html). */
export function CollectionListingsSectionHeader({
  compact = false,
  activeCount,
}: {
  /** Mobile listings band */
  compact?: boolean;
  activeCount?: number;
}) {
  return (
    <header
      className={compact ? "cd-listings-header cd-listings-header--mobile" : "cd-listings-header"}
      aria-labelledby="collection-listings-heading"
    >
      <div className="cd-listings-header__copy">
        <h2 id="collection-listings-heading" className="cd-listings-header__title">
          Listings
        </h2>
      </div>
      {activeCount != null ? (
        <span className="cd-listings-header__count">
          {activeCount} active
        </span>
      ) : null}
    </header>
  );
}
