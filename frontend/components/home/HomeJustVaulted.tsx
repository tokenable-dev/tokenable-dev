"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { HomeCardGrid } from "@/components/home/HomeCardGrid";
import { useHomeMarketplaceGrids } from "@/hooks/home";

export function HomeJustVaulted() {
  const t = useTranslations("Home");
  const { justVaulted, snapshotByKey, isPending, snapshotsPending } =
    useHomeMarketplaceGrids();

  return (
    <section className="tkl-wrap home-section home-section--vaulted">
      <div className="home-section-head">
        <div>
          <h2 className="tkl-sec-title">{t("newItems")}</h2>
          <p className="tkl-sec-sub">{t("newItemsCopy")}</p>
        </div>
        <Link href="/markets?sort=newest" className="tkl-view-all">
          {t("viewAll")}
        </Link>
      </div>
      {isPending ? (
        <p className="tkl-mono text-sm text-[var(--t2)] py-8 text-center">{t("loading")}</p>
      ) : (
        <HomeCardGrid
          collections={justVaulted}
          snapshotByKey={snapshotByKey}
          subMode="change"
          changeLoading={snapshotsPending}
        />
      )}
    </section>
  );
}
