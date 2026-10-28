"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { marketCategoryMessageId } from "@/lib/market";
import {
  localizeCatalogPhrase,
  localizeDisplayedCardName,
  useCatalogNameRevision,
} from "@/lib/marketplace/catalogNameTranslation";
import type { CollectionDetailCard } from "@/lib/marketplace/collectionDetailTypes";

const ROW_LABEL_KEY = {
  character: "cardName",
  category: "category",
  series: "series",
  set: "set",
  "set-code": "setCode",
  "card-number": "cardNumber",
  variant: "variant",
  year: "year",
  grade: "grade",
  grader: "grader",
  language: "language",
} as const;

function localizeCatalogLanguage(
  value: string,
  t: ReturnType<typeof useTranslations<"CollectionDetail">>,
): string {
  if (/^english$/i.test(value)) return t("langEnglish");
  if (/^japanese$/i.test(value)) return t("langJapanese");
  if (/^korean$/i.test(value)) return t("langKorean");
  if (/^chinese$/i.test(value)) return t("langChinese");
  return value;
}

/** Card.html sidebar Details rows — same on mobile and desktop. */
function DetailsBody({
  title,
  subtitle,
  catalogLine,
  rows,
  footer,
}: {
  title: string;
  subtitle?: string | null;
  catalogLine?: string | null;
  rows: CollectionDetailCard[];
  footer?: ReactNode;
}) {
  const t = useTranslations("CollectionDetail");
  const tMarkets = useTranslations("Markets");
  useCatalogNameRevision();
  return (
    <article className="w-full min-w-0 bg-transparent px-0 py-0">
      <h2 className="sr-only">{title}</h2>
      {subtitle?.trim() ? <p className="sr-only">{subtitle}</p> : null}
      {catalogLine?.trim() ? (
        <p className="cd-details-kv__catalog" title={catalogLine}>
          {catalogLine}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <dl
          className={`cd-details-kv${catalogLine?.trim() ? " cd-details-kv--with-catalog" : ""}`}
        >
          {rows.map((row) => {
            const href = row.href?.trim() || null;
            const categoryKey =
              row.id === "category" ? marketCategoryMessageId(row.value) : null;
            const catalogPhrase =
              row.id === "series" ||
              row.id === "set" ||
              row.id === "variant" ||
              row.id === "product" ||
              (row.id === "category" && !categoryKey);
            const value =
              row.id === "language"
                ? localizeCatalogLanguage(row.value, t)
                : row.id === "character"
                  ? localizeDisplayedCardName(row.value)
                  : categoryKey
                    ? tMarkets(categoryKey)
                    : catalogPhrase
                      ? localizeCatalogPhrase(row.value)
                      : row.value;
            return (
              <div
                key={row.id}
                className={`cd-details-kv__row${
                  row.id === "owner" ? " cd-details-kv__row--break" : ""
                }`}
              >
                <dt className="cd-details-kv__label">
                  {ROW_LABEL_KEY[row.id as keyof typeof ROW_LABEL_KEY]
                    ? t(ROW_LABEL_KEY[row.id as keyof typeof ROW_LABEL_KEY])
                    : row.label}
                </dt>
                <dd
                  className="cd-details-kv__value"
                  title={row.suffix ? `${value} ${row.suffix}` : value}
                >
                  {href ? (
                    <Link
                      href={href}
                      className="cd-details-kv__attr-link"
                      title={t("browseFor", { value })}
                    >
                      <span className="cd-details-kv__attr-text">{value}</span>
                    </Link>
                  ) : (
                    <span className="cd-details-kv__attr-text">{value}</span>
                  )}
                  {row.suffix ? (
                    <span className="cd-details-kv__suffix">{row.suffix}</span>
                  ) : null}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}

      {footer ? (
        <div className={rows.length > 0 ? "mt-2 px-5 pb-1 pt-2" : "px-5 py-3"}>
          {footer}
        </div>
      ) : null}
    </article>
  );
}

export function CollectionDetailsKvCard({
  title,
  subtitle,
  catalogLine,
  rows,
  footer,
}: {
  title: string;
  subtitle?: string | null;
  catalogLine?: string | null;
  rows: CollectionDetailCard[];
  footer?: ReactNode;
  /** @deprecated Compact mobile sheet removed — Card.html uses full KV on all breakpoints. */
  compact?: boolean;
  /** @deprecated Unused — kept for call-site compatibility. */
  compactRows?: CollectionDetailCard[];
}) {
  return (
    <DetailsBody
      title={title}
      subtitle={subtitle}
      catalogLine={catalogLine}
      rows={rows}
      footer={footer}
    />
  );
}
