"use client";

export function MarketsPageHeader({
  searchQuery,
  resultCount,
}: {
  searchQuery?: string;
  resultCount?: number;
}) {
  if (searchQuery != null) {
    const q = searchQuery.trim();
    return (
      <header className="markets-page__header tkl-wrap">
        <span className="tkl-eyebrow">Search</span>
        <p className="markets-page__search-sub">
          {q ? (
            <>
              {resultCount != null ? (
                <>
                  <b>{resultCount.toLocaleString("en-US")}</b> results
                  <span className="markets-page__search-dot"> · for </span>
                </>
              ) : (
                <span className="markets-page__search-dot">Results for </span>
              )}
              <span className="markets-page__search-q">&quot;{q}&quot;</span>
            </>
          ) : (
            "Search collections"
          )}
        </p>
      </header>
    );
  }

  return (
    <header className="markets-page__header tkl-wrap">
      <span className="tkl-eyebrow">On-chain now</span>
      <h1 className="markets-page__title tkl-page-title">Markets</h1>
    </header>
  );
}
