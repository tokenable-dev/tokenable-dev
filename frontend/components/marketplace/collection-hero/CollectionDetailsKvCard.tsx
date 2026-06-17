"use client";

import { IBM_Plex_Sans } from "next/font/google";
import { type ReactNode } from "react";
import { COLLECTION_DETAILS_BG_CLASS } from "@/components/marketplace/collectionOverviewChrome";
import {
  collectionDetailArialClass,
} from "@/components/marketplace/price-metrics-strip/theme";
import type { CollectionDetailCard } from "@/lib/marketplace/collectionDetailTypes";

const detailsKvFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

/** Desktop collection detail — slightly above Trades tape; inset from panel edges. */
const DESKTOP_ROW_LABEL_CLASS = `${collectionDetailArialClass} min-w-0 flex-1 text-[13px] font-medium leading-snug text-zinc-500`;
const DESKTOP_ROW_VALUE_CLASS = `${collectionDetailArialClass} min-w-0 shrink-0 max-w-[58%] text-right text-[14px] font-medium leading-[1.35] text-white [overflow-wrap:anywhere]`;
const DESKTOP_KV_INSET_CLASS = "lg:px-2.5";

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
    <article
      className={`hidden rounded-2xl ${COLLECTION_DETAILS_BG_CLASS} px-3 py-2 sm:px-4 sm:py-3 lg:block lg:rounded-none lg:bg-transparent lg:px-0 lg:py-0 lg:pb-1 ${DESKTOP_KV_INSET_CLASS}`}
    >
      <h2 className="sr-only">{title}</h2>
      {subtitle?.trim() ? (
        <p className="sr-only">{subtitle}</p>
      ) : null}
      {catalogLine?.trim() ? (
        <p className={DESKTOP_ROW_LABEL_CLASS}>{catalogLine}</p>
      ) : null}

      {rows.length > 0 ? (
        <dl
          className={`space-y-0 ${catalogLine?.trim() ? "mt-1.5" : ""}`}
        >
          {rows.map((row) => (
            <div key={row.id} className="flex gap-2 py-0.5 sm:gap-2.5 sm:py-1 lg:py-1">
              <dt className={DESKTOP_ROW_LABEL_CLASS}>{row.label}</dt>
              <dd className={DESKTOP_ROW_VALUE_CLASS}>{row.value}</dd>
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
