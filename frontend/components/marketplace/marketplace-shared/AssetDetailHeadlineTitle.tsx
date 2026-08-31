"use client";

import { cn } from "@/lib/ds/cn";
import {
  assetDetailHeadlineHasContent,
  formatCardDisplayHoverTitle,
  formatCardDisplayName,
  resolveCardDisplayGrade,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";

/** SSOT Line 1 title — always reserves 2 lines; ellipsis when longer. */
export const CARD_DISPLAY_LINE1_CLAMP_CLASS = "cd-display-name--line1-clamp-2";

/**
 * Hero title Line 1 — `{Name} · {Number} · {Grade}` (grade never empty — `Raw` when ungraded).
 * Variant / set / year belong on the meta (Line 2) line only.
 */
export function AssetDetailHeadlineTitle({
  parts,
  className,
  style,
  as: Tag = "span",
  grade,
  id,
}: {
  parts: AssetDetailHeadlineParts;
  className?: string;
  style?: React.CSSProperties;
  as?: "h1" | "h2" | "p" | "span";
  grade?: string | null;
  id?: string;
  /** @deprecated Variant belongs on Line 2 — ignored. */
  collisionSuffix?: string | null;
  /** @deprecated Always uses 2-line clamp now. */
  truncateName?: boolean;
  /** @deprecated Variant is always on the meta line now. */
  omitVariety?: boolean;
}) {
  if (!assetDetailHeadlineHasContent(parts)) return null;

  const name = parts.cardName?.trim() || "";
  const cardNumber = parts.cardNumber?.trim() || "";
  const gradeText = resolveCardDisplayGrade(grade);
  if (!name && !cardNumber && gradeText === resolveCardDisplayGrade(null)) return null;

  const displayName = formatCardDisplayName(parts, { grade });
  const hover = formatCardDisplayHoverTitle(parts, { grade });

  return (
    <Tag
      className={cn(CARD_DISPLAY_LINE1_CLAMP_CLASS, className)}
      style={style}
      title={hover || displayName}
      id={id}
    >
      {name ? <span className="cd-display-name__name">{name}</span> : null}
      {cardNumber ? (
        <span className="cd-display-name__meta">
          {name ? " · " : ""}
          {cardNumber}
        </span>
      ) : null}
      <>
        {name || cardNumber ? (
          <span className="cd-display-name__meta">{" · "}</span>
        ) : null}
        <strong className="cd-display-name__grade">{gradeText}</strong>
      </>
    </Tag>
  );
}
