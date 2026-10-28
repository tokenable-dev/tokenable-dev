"use client";

import { useLocale, useTranslations } from "next-intl";

export function MarketsPageHeader({
  searchQuery,
  resultCount,
}: {
  searchQuery?: string;
  /** Search.html `#srchCount` — omitted while results are still loading. */
  resultCount?: number | null;
}) {
  const t = useTranslations("Markets");
  const tNav = useTranslations("Nav");
  const tSearch = useTranslations("Search");
  const locale = useLocale();

  if (searchQuery != null) {
    const q = searchQuery.trim();
    return (
      <header className="markets-page__header tkl-wrap">
        <span className="tkl-eyebrow">{tSearch("button")}</span>
        <p className="markets-page__search-sub">
          {q ? (
            <>
              {resultCount != null ? (
                <>
                  {t.rich("resultCount", {
                    count: resultCount.toLocaleString(locale),
                    b: (chunks) => <b>{chunks}</b>,
                  })}{" "}
                  <span className="markets-page__search-dot">{t("forQuery")}</span>{" "}
                </>
              ) : (
                <span className="markets-page__search-dot">{t("resultsForLead")} </span>
              )}
              <span className="markets-page__search-q">&quot;{q}&quot;</span>
            </>
          ) : (
            t("searchCollections")
          )}
        </p>
      </header>
    );
  }

  return (
    <header className="markets-page__header tkl-wrap">
      <span className="tkl-eyebrow">{t("onChainNow")}</span>
      <h1 className="markets-page__title tkl-page-title">{tNav("markets")}</h1>
    </header>
  );
}
