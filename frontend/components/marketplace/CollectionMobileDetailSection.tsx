"use client";

import { useState } from "react";
import type { CollectionDetailCard } from "@/components/marketplace/CollectionMetadataExpandable";
import { COLLECTION_DETAILS_BG_CLASS } from "@/components/marketplace/collectionOverviewChrome";

function DetailChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        d="M7 10l5 5 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CollectionMobileDetailSection({
  rows,
  title = "Detail",
  defaultExpanded = false,
}: {
  rows: CollectionDetailCard[];
  title?: string;
  defaultExpanded?: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);

  if (rows.length === 0) return null;

  return (
    <section
      className={`w-full min-w-0 pt-4 xl:hidden ${COLLECTION_DETAILS_BG_CLASS}`}
      aria-label={title}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full min-w-0 items-center justify-between gap-3 px-4 py-2.5 text-left ${COLLECTION_DETAILS_BG_CLASS}`}
      >
        <h2 className="text-[15px] font-bold tracking-tight text-white">{title}</h2>
        <DetailChevron expanded={open} />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <dl
            className={`flex w-full min-w-0 flex-col gap-y-2.5 px-4 pb-4 ${COLLECTION_DETAILS_BG_CLASS}`}
          >
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-start justify-between gap-4"
              >
                <dt className="min-w-0 shrink-0 text-[13px] font-normal text-zinc-500">
                  {row.label}
                </dt>
                <dd className="min-w-0 max-w-[58%] text-right text-[13px] font-medium leading-snug text-white [overflow-wrap:anywhere]">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
