"use client";

import { useTranslations } from "next-intl";

export function WatchlistPageHeader() {
  const t = useTranslations("Watch");
  return (
    <header className="watchlist-page__header tkl-wrap">
      <span className="tkl-eyebrow">{t("eyebrow")}</span>
      <h1 className="watchlist-page__title tkl-page-title">{t("title")}</h1>
      <p className="tkl-sec-sub watchlist-page__subtitle">{t("sub")}</p>
    </header>
  );
}
