"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { HomeCardGrid } from "@/components/home/HomeCardGrid";
import { useHomeMarketplaceGrids } from "@/hooks/home";

export function HomeTopMovers() {
  const t = useTranslations("Home");
  const { topMovers, snapshotByKey, isPending, snapshotsPending } =
    useHomeMarketplaceGrids();

  return (
    <section className="tkl-wrap home-section">
      <div className="home-section-head">
        <div>
          <h2 className="tkl-sec-title">{t("topMovers")}</h2>
          <p className="tkl-sec-sub">{t("topMoversCopy")}</p>
        </div>
        <Link href="/markets?sort=gainers" className="tkl-view-all">
          {t("viewAll")}
        </Link>
      </div>
      {isPending ? (
        <p className="tkl-mono text-sm text-[var(--t2)] py-8 text-center">{t("loading")}</p>
      ) : (
        <HomeCardGrid
          collections={topMovers}
          snapshotByKey={snapshotByKey}
          subMode="change"
          changeLoading={snapshotsPending}
        />
      )}
    </section>
  );
}
