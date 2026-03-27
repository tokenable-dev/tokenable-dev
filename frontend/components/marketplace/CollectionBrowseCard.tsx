"use client";

import Link from "next/link";
import { CollectionCoverFrame } from "./CollectionCoverFrame";

interface CollectionBrowseCardProps {
  collectionKey: string;
  displayLabel: string;
  listingCount: number;
  /** JustTCG 카드 아트 URL (컬렉션 고정 커버) */
  coverImageUrl?: string | null;
  /** 컬렉션 메타가 없는 기타 매물 */
  variant?: "default" | "other";
}

export function CollectionBrowseCard({
  collectionKey,
  displayLabel,
  listingCount,
  coverImageUrl,
  variant = "default",
}: CollectionBrowseCardProps) {
  const href =
    variant === "other"
      ? "/marketplace/other-listings"
      : `/marketplace/collections/${encodeURIComponent(collectionKey)}`;

  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-mint-deep/25 bg-gradient-to-br from-mint/[0.08] via-gray-900/80 to-gray-950/90 p-4 sm:p-5 shadow-sm shadow-black/20 transition-all hover:border-mint/45 hover:from-mint/[0.12] hover:shadow-mint/5"
    >
      <div className="flex items-stretch justify-between gap-3">
        {variant !== "other" && coverImageUrl ? (
          <CollectionCoverFrame
            imageUrl={coverImageUrl}
            variant="compact"
            className="shrink-0 w-[4.5rem] sm:w-[5.25rem]"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-mint/80 mb-1.5">
            {variant === "other" ? "Ungrouped" : "Collection"}
          </p>
          <h3 className="text-sm font-bold text-white leading-snug line-clamp-3 group-hover:text-mint/95 transition-colors">
            {displayLabel}
          </h3>
          <p className="mt-3 text-xs text-gray-500">
            <span className="tabular-nums font-semibold text-gray-300">
              {listingCount}
            </span>{" "}
            listing{listingCount === 1 ? "" : "s"}
          </p>
          {variant !== "other" && coverImageUrl ? (
            <p className="mt-2 text-[10px] text-gray-600 leading-snug">
              Illustrative card art — not a specific cert.
            </p>
          ) : null}
        </div>
        <span
          className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-gray-700 bg-gray-900/80 text-mint text-lg group-hover:border-mint/35 group-hover:bg-mint/10 transition-colors"
          aria-hidden
        >
          →
        </span>
      </div>
    </Link>
  );
}
