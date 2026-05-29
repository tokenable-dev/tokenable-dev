"use client";

import { useMemo } from "react";
import { isSportCategoryLeagueDisplayLabel } from "@/lib/market";
import {
  getRwaDetailHeaderBadgeLabels,
  type RwaDetailMetadata,
} from "@/lib/marketplace/rwa-detail";
import {
  RWA_DETAIL_OUTLINE_TAG_DESKTOP,
  RWA_DETAIL_OUTLINE_TAG_MOBILE,
} from "../theme/constants";

/** Collection-style outline badges (e.g. MLB · PSA 10) for RWA buy/detail headers. */
export function RwaDetailHeaderBadges({
  metadata,
  loading = false,
  className = "",
  variant = "desktop",
}: {
  metadata: RwaDetailMetadata | null;
  loading?: boolean;
  className?: string;
  variant?: "desktop" | "mobile";
}) {
  const tagClass =
    variant === "mobile" ? RWA_DETAIL_OUTLINE_TAG_MOBILE : RWA_DETAIL_OUTLINE_TAG_DESKTOP;
  const { category, gradeLine } = useMemo(
    () => getRwaDetailHeaderBadgeLabels(metadata),
    [metadata],
  );

  if (loading && !category && !gradeLine) {
    return (
      <div
        className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
        aria-hidden
      >
        <span className="h-[26px] w-[4.5rem] animate-pulse rounded border border-zinc-800 bg-zinc-800/80" />
        <span className="h-[26px] w-14 animate-pulse rounded border border-zinc-800 bg-zinc-800/80" />
      </div>
    );
  }

  if (!category && !gradeLine) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 ${className}`.trim()}
      aria-label="Card tags"
    >
      {category ? (
        <span
          className={`${tagClass} ${
            isSportCategoryLeagueDisplayLabel(category) ? "uppercase" : "capitalize"
          }`}
        >
          {category}
        </span>
      ) : null}
      {gradeLine ? <span className={tagClass}>{gradeLine}</span> : null}
    </div>
  );
}
