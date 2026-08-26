"use client";

import {
  assetDetailHeadlineHasContent,
  formatCardDisplayHoverTitle,
  formatCardDisplayName,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";

/**
 * Hero title line — `{Name} · {Number} · {Grade}`.
 * Variant lives on the meta line (`Year · Set · Variant`), not here.
 *
 * Important: never fall back to the full `formatCardDisplayName` string for the
 * name slot — that string already includes number/grade, and appending them
 * again produced "PSA 10 · PSA 10" / "6 · PSA 10 · 6 · PSA 10" on mobile.
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
  /** @deprecated Variant is always on the meta line now. */
  omitVariety?: boolean;
}) {
  if (!assetDetailHeadlineHasContent(parts)) return null;

  const name = parts.cardName?.trim() || "";
  const cardNumber = parts.cardNumber?.trim() || "";
  const gradeText = grade?.trim() || "";
  // Variety belongs on the meta line — do not promote it into the title.
  if (!name && !cardNumber && !gradeText) return null;

  const displayName = formatCardDisplayName(parts, { grade });
  const hover = formatCardDisplayHoverTitle(parts, { grade });

  return (
    <Tag className={className} style={style} title={hover || displayName} id={id}>
      <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
        {name ? <span className="cd-display-name__name">{name}</span> : null}
        {cardNumber ? (
          <span className="cd-display-name__meta">
            {name ? " · " : ""}
            {cardNumber}
          </span>
        ) : null}
        {gradeText ? (
          <>
            {name || cardNumber ? (
              <span className="cd-display-name__meta">{" · "}</span>
            ) : null}
            <strong className="cd-display-name__grade">{gradeText}</strong>
          </>
        ) : null}
      </span>
    </Tag>
  );
}
