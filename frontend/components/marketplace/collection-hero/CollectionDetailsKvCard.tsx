"use client";

import { IBM_Plex_Sans } from "next/font/google";
import { type ReactNode } from "react";
import { COLLECTION_DETAILS_BG_CLASS } from "@/components/marketplace/collectionOverviewChrome";
import type { CollectionDetailCard } from "@/lib/marketplace/collectionDetailTypes";

const detailsKvFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const ROW_LABEL_CLASS = `${detailsKvFont.className} min-w-0 flex-1 text-[13px] font-normal leading-snug tracking-normal text-[#a0a0a0] sm:text-[14px] sm:leading-[140%]`;
const ROW_VALUE_CLASS = `${detailsKvFont.className} min-w-0 shrink-0 max-w-[62%] text-right text-[14px] font-medium leading-snug tracking-normal text-white [overflow-wrap:anywhere] sm:max-w-[58%] sm:text-[15px] sm:leading-[140%]`;

function CompactDetailsBody({
  rows,
  footer,
  title,
}: {
  rows: CollectionDetailCard[];
  footer?: ReactNode;
  title: string;
}) {
  return (
    <article className="mx-auto w-full min-w-0 max-w-[min(100%,20rem)] bg-transparent px-3 py-2 lg:hidden">
      <h2 className="sr-only">{title}</h2>
      <dl className="flex w-full min-w-0 flex-col gap-y-1.5">
        {rows.map((row) => (
          <div key={row.id} className="flex items-start justify-between gap-4">
            <dt
              className={`${detailsKvFont.className} min-w-0 max-w-[40%] shrink-0 text-[10px] font-normal leading-snug text-zinc-500`}
            >
              {row.label}
            </dt>
            <dd
              className={`${detailsKvFont.className} min-w-0 flex-1 text-right text-[11px] font-medium leading-snug text-zinc-300 [overflow-wrap:anywhere]`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {footer ? (
        <div className="mt-3 text-[10px] leading-snug text-zinc-600">{footer}</div>
      ) : null}
    </article>
  );
}

function FullDetailsBody({
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
    <article className={`hidden rounded-2xl ${COLLECTION_DETAILS_BG_CLASS} px-3 py-2 sm:px-4 sm:py-3 lg:px-5 lg:pb-4 lg:pt-2 lg:block`}>
      <h2 className="sr-only">{title}</h2>
      {subtitle?.trim() ? (
        <p className="sr-only">{subtitle}</p>
      ) : null}
      {catalogLine?.trim() ? (
        <p
          className={`${detailsKvFont.className} text-[11px] font-normal leading-snug tracking-normal text-[#a0a0a0] sm:text-[12px] sm:leading-[140%]`}
        >
          {catalogLine}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <dl
          className={`space-y-0 ${catalogLine?.trim() ? "mt-1.5 sm:mt-2" : ""}`}
        >
          {rows.map((row) => (
            <div key={row.id} className="flex gap-2 py-1 sm:gap-2.5 sm:py-1.5">
              <dt className={ROW_LABEL_CLASS}>{row.label}</dt>
              <dd className={ROW_VALUE_CLASS}>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {footer ? (
        <div className={`${rows.length > 0 ? "mt-2 pt-2 sm:mt-2.5 sm:pt-2.5" : "mt-1"}`}>{footer}</div>
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
  /** Mobile-only spec sheet under the hero Details tab; desktop keeps the full card. */
  compact = false,
  /** Rows shown in the mobile compact sheet (defaults to {@link rows}). */
  compactRows,
}: {
  title: string;
  subtitle?: string | null;
  catalogLine?: string | null;
  rows: CollectionDetailCard[];
  footer?: ReactNode;
  compact?: boolean;
  compactRows?: CollectionDetailCard[];
}) {
  if (compact && rows.length > 0) {
    const mobileRows = compactRows ?? rows;
    return (
      <>
        <CompactDetailsBody rows={mobileRows} footer={footer} title={title} />
        <FullDetailsBody
          title={title}
          subtitle={subtitle}
          catalogLine={catalogLine}
          rows={rows}
          footer={footer}
        />
      </>
    );
  }

  return (
    <FullDetailsBody
      title={title}
      subtitle={subtitle}
      catalogLine={catalogLine}
      rows={rows}
      footer={footer}
    />
  );
}
