"use client";

import { cn } from "@/lib/ds/cn";
import {
  assetDetailHeadlineHasContent,
  formatCardDisplayHoverTitle,
  formatCardDisplayLine1,
  cardDisplayPartsFromAssetDetail,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";

/** SSOT Line 1 — single run `{Name} · {Number} · {Grade}` with end ellipsis. */
export const CARD_DISPLAY_LINE1_CLAMP_CLASS = "cd-display-name--line1-clamp-2";

/**
 * Hero / card title Line 1.
 * Default: `{Name} · {Number} · {Grade}` (grade never empty — `Raw` when ungraded).
 * Certificate of Ownership (`includeGrade={false}`): `{Name} · {Number}`.
 */
export function AssetDetailHeadlineTitle({
  parts,
  className,
  style,
  as: Tag = "span",
  grade,
  includeGrade = true,
  id,
}: {
  parts: AssetDetailHeadlineParts;
  className?: string;
  style?: React.CSSProperties;
  as?: "h1" | "h2" | "p" | "span";
  grade?: string | null;
  /** When false, Line 1 is name + number only (portfolio certificate). */
  includeGrade?: boolean;
  id?: string;
}) {
  if (!assetDetailHeadlineHasContent(parts)) return null;

  const line1 = formatCardDisplayLine1(
    cardDisplayPartsFromAssetDetail(parts, grade),
    { omitGrade: !includeGrade },
  );
  if (!line1) return null;

  const hover = formatCardDisplayHoverTitle(parts, {
    grade,
    omitGrade: !includeGrade,
  });

  return (
    <Tag
      className={cn(CARD_DISPLAY_LINE1_CLAMP_CLASS, className)}
      style={style}
      title={hover || line1}
      id={id}
    >
      {line1}
    </Tag>
  );
}
