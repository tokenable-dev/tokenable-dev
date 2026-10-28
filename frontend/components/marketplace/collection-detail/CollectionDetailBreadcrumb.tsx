"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { marketCategoryMessageId } from "@/lib/market";

export function CollectionDetailBreadcrumb({
  categoryLabel,
  trailLabel,
}: {
  categoryLabel?: string | null;
  trailLabel: string;
}) {
  const tNav = useTranslations("Nav");
  const t = useTranslations("CollectionDetail");
  const tMarkets = useTranslations("Markets");
  const rawCategory = categoryLabel?.trim();
  const categoryKey = marketCategoryMessageId(rawCategory);
  const category = categoryKey ? tMarkets(categoryKey) : rawCategory;
  const trail = trailLabel.trim();

  return (
    <nav className="cd-breadcrumb" aria-label={t("breadcrumb")}>
      <Link href="/markets">{tNav("markets")}</Link>
      {category ? (
        <>
          <span className="cd-breadcrumb__sep" aria-hidden>
            /
          </span>
          <span className="cd-breadcrumb__mid">{category}</span>
        </>
      ) : null}
      {trail ? (
        <>
          <span className="cd-breadcrumb__sep" aria-hidden>
            /
          </span>
          <span className="cd-breadcrumb__current">{trail}</span>
        </>
      ) : null}
    </nav>
  );
}
