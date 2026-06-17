"use client";

/** Section break between market chart cluster and listing grid (OpenSea / Blur-style). */
export function CollectionListingsSectionHeader({
  compact = false,
}: {
  /** Mobile listings band below tabs */
  compact?: boolean;
}) {
  return (
    <header
      className={`relative ${compact ? "mb-3 pt-3" : "mb-3 pt-2 lg:mb-3 lg:pt-2"}`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-700/75 to-transparent"
        aria-hidden
      />
      <h2
        id="collection-listings-heading"
        className={
          compact
            ? "min-w-0 text-[15px] font-bold tracking-tight text-white"
            : "min-w-0 text-[15px] font-semibold tracking-tight text-white sm:text-base lg:text-[17px]"
        }
      >
        Listings
      </h2>
    </header>
  );
}
