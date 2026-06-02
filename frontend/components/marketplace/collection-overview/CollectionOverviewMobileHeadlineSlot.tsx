"use client";

import { CollectionMobileHeadline } from "./header/CollectionMobileHeadline";
import type { CollectionOverviewBoardProps } from "./types";

type MobileHeadlineSlotProps = Pick<
  CollectionOverviewBoardProps,
  | "headlineTitle"
  | "headlineStructuredTitle"
  | "categoryBadge"
  | "gradeBadge"
  | "populationBadge"
  | "badgeLabel"
> & {
  show: boolean;
  headlineSubtitleLine: string | null;
  mobileHeadlineCopy?: {
    subtitleLine: string | null;
    cardNumber: string | null;
  } | null;
  suppressHeadlineBanner: boolean;
};

export function CollectionOverviewMobileHeadlineSlot({
  show,
  headlineTitle,
  headlineStructuredTitle,
  headlineSubtitleLine,
  mobileHeadlineCopy,
  categoryBadge,
  gradeBadge,
  populationBadge,
  badgeLabel = "Collection",
  suppressHeadlineBanner,
}: MobileHeadlineSlotProps) {
  if (!show || !headlineTitle) return null;

  return (
    <CollectionMobileHeadline
      headlineTitle={headlineTitle}
      headlineStructuredTitle={headlineStructuredTitle}
      headlineSubtitleLine={mobileHeadlineCopy?.subtitleLine ?? headlineSubtitleLine}
      headlineCardNumber={mobileHeadlineCopy?.cardNumber}
      categoryBadge={categoryBadge}
      gradeBadge={gradeBadge}
      populationBadge={populationBadge}
      badgeLabel={badgeLabel}
      suppressTitle={suppressHeadlineBanner}
    />
  );
}
