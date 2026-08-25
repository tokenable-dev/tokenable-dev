"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import type { CollectionDetailCard } from "@/lib/marketplace/collectionDetailTypes";

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
  return (
    <article className="w-full min-w-0 bg-transparent px-0 py-0">
      <h2 className="sr-only">{title}</h2>
      {subtitle?.trim() ? <p className="sr-only">{subtitle}</p> : null}
      {catalogLine?.trim() ? (
        <p className="cd-details-kv__catalog">{catalogLine}</p>
      ) : null}

      {rows.length > 0 ? (
        <dl
          className={`cd-details-kv${catalogLine?.trim() ? " cd-details-kv--with-catalog" : ""}`}
        >
          {rows.map((row) => {
            const href = row.href?.trim() || null;
            return (
              <div key={row.id} className="cd-details-kv__row">
                <dt className="cd-details-kv__label">{row.label}</dt>
                <dd className="cd-details-kv__value">
                  {href ? (
                    <Link
                      href={href}
                      className="cd-details-kv__attr-link"
                      title={`Browse Markets for ${row.value}`}
                    >
                      {row.value}
                      <span className="cd-details-kv__attr-arrow" aria-hidden>
                        ↗
                      </span>
                    </Link>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}

      {footer ? (
        <div className={rows.length > 0 ? "mt-2 px-4 pb-3 pt-2" : "px-4 py-3"}>
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
