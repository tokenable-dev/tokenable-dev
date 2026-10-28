"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * Collection detail mobile — Card.html column order:
 * chart-card (hero + price history) → rail (book + details) → similar.
 */
export function CollectionDetailMobileScrollPanel({
  chartPanel,
  similarPanel,
  orderBookStack,
  detailsPanel,
  /** @deprecated Hero nests inside chart-card; kept optional for callers. */
  statBlock,
}: {
  chartPanel: ReactNode;
  similarPanel?: ReactNode;
  orderBookStack: ReactNode;
  detailsPanel?: ReactNode;
  statBlock?: ReactNode;
}) {
  const t = useTranslations("CollectionChrome");
  return (
    <div className="cd-mobile-scroll cd-hero-sticky-scope flex w-full min-w-0 flex-col min-[1141px]:hidden">
      {statBlock != null ? (
        <section className="cd-mobile-scroll__stat w-full min-w-0" aria-label={t("marketSummary")}>
          {statBlock}
        </section>
      ) : null}

      <section className="cd-mobile-scroll__chart w-full min-w-0" aria-label={t("priceChart")}>
        {chartPanel}
      </section>

      <section
        className="cd-mobile-scroll__book cd-notch w-full min-w-0 overflow-hidden"
        aria-label={t("listings")}
      >
        {orderBookStack}
      </section>

      {detailsPanel != null ? (
        <section
          className="cd-mobile-scroll__details cd-sidebar-details cd-notch w-full min-w-0 overflow-hidden"
          aria-label={t("details")}
        >
          {detailsPanel}
        </section>
      ) : null}

      {similarPanel != null ? (
        <section
          className="cd-mobile-scroll__similar w-full min-w-0"
          aria-label={t("similar")}
        >
          {similarPanel}
        </section>
      ) : null}
    </div>
  );
}
