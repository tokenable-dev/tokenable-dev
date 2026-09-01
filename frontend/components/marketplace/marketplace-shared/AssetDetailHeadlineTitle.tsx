"use client";

import { cn } from "@/lib/ds/cn";
import {
  assetDetailHeadlineHasContent,
  formatCardDisplayHoverTitle,
  formatCardDisplayName,
  resolveCardDisplayGrade,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";
import { formatHeadlineCardNumber } from "@/lib/marketplace/collectionFullDetailsTitle";

function nameWithoutDuplicateNumber(name: string, cardNumber: string): string {
  if (!name || !cardNumber) return name;
  const escaped = cardNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = name
    .replace(new RegExp(`(?:\\s*[·•#]\\s*|\\s+)${escaped}\\s*$`, "i"), "")
    .trim();
  return stripped || name;
}

/** SSOT Line 1 title — one line; ellipsis when it overflows. */
export const CARD_DISPLAY_LINE1_CLAMP_CLASS = "cd-display-name--line1-clamp-2";

/**
 * Hero / card title Line 1.
 * Default: `{Name} · {Number} · {Grade}` (grade never empty — `Raw` when ungraded).
 * Certificate of Ownership (`includeGrade={false}`): `{Name} · {Number}` — grade is shown below.
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
  /** @deprecated Variant belongs on Line 2 — ignored. */
  collisionSuffix?: string | null;
  /** @deprecated Always uses 1-line ellipsis now. */
  truncateName?: boolean;
  /** @deprecated Variant is always on the meta line now. */
  omitVariety?: boolean;
}) {
  if (!assetDetailHeadlineHasContent(parts)) return null;

  const nameRaw = parts.cardName?.trim() || "";
  const cardNumber =
    formatHeadlineCardNumber(parts.cardNumber)?.trim() ||
    parts.cardNumber?.trim() ||
    "";
  const name = nameWithoutDuplicateNumber(nameRaw, cardNumber);
  const gradeText = includeGrade ? resolveCardDisplayGrade(grade) : "";
  if (!name && !cardNumber && !includeGrade) return null;
  if (
    !name &&
    !cardNumber &&
    includeGrade &&
    gradeText === resolveCardDisplayGrade(null)
  ) {
    return null;
  }

  const displayName = formatCardDisplayName(parts, {
    grade,
    omitGrade: !includeGrade,
  });
  const hover = formatCardDisplayHoverTitle(parts, {
    grade,
    omitGrade: !includeGrade,
  });

  return (
    <Tag
      className={cn(CARD_DISPLAY_LINE1_CLAMP_CLASS, className)}
      style={style}
      title={hover || displayName}
      id={id}
    >
      {name ? <span className="cd-display-name__name">{name}</span> : null}
      {cardNumber ? (
        <>
          {name ? (
            <span className="cd-display-name__sep" aria-hidden>
              ·
            </span>
          ) : null}
          <span className="cd-display-name__meta">{cardNumber}</span>
        </>
      ) : null}
      {includeGrade ? (
        <>
          {name || cardNumber ? (
            <span className="cd-display-name__sep" aria-hidden>
              ·
            </span>
          ) : null}
          <strong className="cd-display-name__grade">{gradeText}</strong>
        </>
      ) : null}
    </Tag>
  );
}
