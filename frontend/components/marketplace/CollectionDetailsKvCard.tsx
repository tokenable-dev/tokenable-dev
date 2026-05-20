"use client";

import { IBM_Plex_Sans } from "next/font/google";
import { type ReactNode } from "react";
import type { CollectionDetailCard } from "@/components/marketplace/CollectionMetadataExpandable";

const detailsKvFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

/** Tighter leading on small screens keeps the Details block shorter. */
const ROW_LABEL_CLASS = `${detailsKvFont.className} min-w-0 flex-1 text-[13px] font-normal leading-snug tracking-normal text-[#a0a0a0] sm:text-[14px] sm:leading-[140%]`;
const ROW_VALUE_CLASS = `${detailsKvFont.className} min-w-0 shrink-0 max-w-[62%] text-right text-[14px] font-medium leading-snug tracking-normal text-white [overflow-wrap:anywhere] sm:max-w-[58%] sm:text-[15px] sm:leading-[140%]`;

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
}) {
  return (
    <article className="rounded-2xl bg-[rgba(8,8,8,1)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-5 sm:py-5 lg:px-6 lg:py-6">
      <h2
        className={`${detailsKvFont.className} text-[16px] font-bold leading-[140%] tracking-normal text-white sm:text-[17px]`}
      >
        {title}
      </h2>
      {subtitle?.trim() ? (
        <p
          className={`${detailsKvFont.className} mt-2 text-[11px] font-normal leading-snug tracking-normal text-[#a0a0a0] sm:text-[12px] sm:leading-[140%]`}
        >
          {subtitle}
        </p>
      ) : null}
      {catalogLine?.trim() ? (
        <p
          className={`${detailsKvFont.className} mt-1 text-[11px] font-normal leading-snug tracking-normal text-[#a0a0a0] sm:text-[12px] sm:leading-[140%]`}
        >
          {catalogLine}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <dl className="mt-3 space-y-0 sm:mt-4">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex gap-2 py-2 sm:gap-3 sm:py-2.5"
            >
              <dt className={ROW_LABEL_CLASS}>{row.label}</dt>
              <dd className={ROW_VALUE_CLASS}>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {footer ? (
        <div className={`${rows.length > 0 ? "mt-3 pt-3 sm:mt-4 sm:pt-4" : "mt-1"}`}>{footer}</div>
      ) : null}
    </article>
  );
}
