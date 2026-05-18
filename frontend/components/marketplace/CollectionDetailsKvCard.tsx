"use client";

import { IBM_Plex_Sans } from "next/font/google";
import { type ReactNode } from "react";
import type { CollectionDetailCard } from "@/components/marketplace/CollectionMetadataExpandable";

const detailsKvFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const ROW_LABEL_CLASS = `${detailsKvFont.className} min-w-0 flex-1 text-[14px] font-normal leading-[140%] tracking-normal text-[#a0a0a0] sm:text-[15px]`;
const ROW_VALUE_CLASS = `${detailsKvFont.className} min-w-0 shrink-0 max-w-[62%] text-right text-[15px] font-medium leading-[140%] tracking-normal text-white [overflow-wrap:anywhere] sm:max-w-[58%] sm:text-[16px]`;

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
    <article className="rounded-2xl bg-[rgba(8,8,8,1)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-6 sm:py-6">
      <h2
        className={`${detailsKvFont.className} text-[17px] font-bold leading-[140%] tracking-normal text-white sm:text-[18px]`}
      >
        {title}
      </h2>
      {subtitle?.trim() ? (
        <p
          className={`${detailsKvFont.className} mt-2.5 text-[12px] font-normal leading-[140%] tracking-normal text-[#a0a0a0]`}
        >
          {subtitle}
        </p>
      ) : null}
      {catalogLine?.trim() ? (
        <p
          className={`${detailsKvFont.className} mt-1.5 text-[12px] font-normal leading-[140%] tracking-normal text-[#a0a0a0]`}
        >
          {catalogLine}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <dl className="mt-5 space-y-0">
          {rows.map((row, i) => (
            <div
              key={row.id}
              className={`flex gap-2.5 py-3 sm:gap-4 sm:py-4 ${i > 0 ? "border-t border-white/[0.06]" : ""}`}
            >
              <dt className={ROW_LABEL_CLASS}>{row.label}</dt>
              <dd className={ROW_VALUE_CLASS}>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {footer ? <div className={`${rows.length > 0 ? "mt-5 border-t border-white/[0.06] pt-5" : "mt-1"}`}>{footer}</div> : null}
    </article>
  );
}
