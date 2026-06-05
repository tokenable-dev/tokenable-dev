"use client";

/** Section break between market chart cluster and listing grid (OpenSea / Blur-style). */
export function CollectionListingsSectionHeader({
  count,
  compact = false,
}: {
  count?: number;
  /** Mobile listings band below tabs */
  compact?: boolean;
}) {
  const countLabel =
    count == null
      ? null
      : count === 1
        ? "1 for sale"
        : `${count} for sale`;

  return (
    <header
      className={`relative ${compact ? "mb-3 pt-3" : "mb-4 pt-5 lg:mb-5 lg:pt-6"}`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-700/75 to-transparent"
        aria-hidden
      />
      <div className="flex items-center justify-between gap-3">
        <h2
          id="collection-listings-heading"
          className={
            compact
              ? "min-w-0 text-[14px] font-semibold tracking-tight text-white"
              : "min-w-0 text-[15px] font-semibold tracking-tight text-white sm:text-base lg:text-[17px]"
          }
        >
          Listings
        </h2>
        {countLabel ? (
          <span className="shrink-0 rounded-md border border-zinc-800/90 bg-zinc-950/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400 sm:text-[11px] sm:normal-case sm:tracking-normal">
            {countLabel}
          </span>
        ) : null}
      </div>
    </header>
  );
}
