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
import { PsaVaultOutlineTag, PsaVaultOutlineTagSkeleton } from "./PsaVaultBadge";

/** Collection-style outline badges (category · PSA Vault) — grade is on Line 1 headline. */
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
  const { category } = useMemo(
    () => getRwaDetailHeaderBadgeLabels(metadata),
    [metadata],
  );

  if (loading && !category) {
    return (
      <div
        className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
        aria-hidden
      >
        <span className="h-[26px] w-[4.5rem] animate-pulse rounded border border-zinc-800 bg-zinc-800/80 max-sm:h-[20px]" />
        <PsaVaultOutlineTagSkeleton variant={variant} />
      </div>
    );
  }

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
      <PsaVaultOutlineTag variant={variant} />
    </div>
  );
}
