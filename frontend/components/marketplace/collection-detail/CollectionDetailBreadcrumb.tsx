"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function CollectionDetailBreadcrumb({
  categoryLabel,
  trailLabel,
}: {
  categoryLabel?: string | null;
  trailLabel: string;
}) {
  const tNav = useTranslations("Nav");
  const t = useTranslations("CollectionDetail");
  const category = categoryLabel?.trim();
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
