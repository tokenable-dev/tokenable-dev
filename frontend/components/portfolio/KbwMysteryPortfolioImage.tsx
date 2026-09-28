"use client";

import { memo } from "react";
import {
  kbwMysteryCardImageUrl,
} from "@/lib/portfolio/kbwMysteryCard";

/** Same frame for unused / used KBW pack art (652×912). */
export const KbwMysteryPortfolioImage = memo(function KbwMysteryPortfolioImage({
  used,
  className,
}: {
  used: boolean;
  className?: string;
}) {
  const wrapClass = [
    "pf-kbw-mystery-art",
    used ? "pf-kbw-mystery-art--used" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapClass}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={kbwMysteryCardImageUrl(used)}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </div>
  );
});
