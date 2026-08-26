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

  const displayName = formatCardDisplayName(parts, { grade });
  if (!displayName) return null;

  const hover = formatCardDisplayHoverTitle(parts, { grade });
  const name = parts.cardName?.trim() || "";
  const cardNumber = parts.cardNumber?.trim() || "";
  const gradeText = grade?.trim() || "";

  return (
    <Tag className={className} style={style} title={hover || displayName} id={id}>
      <span className="block min-w-0 whitespace-normal [overflow-wrap:anywhere]">
        {name || displayName}
        {cardNumber || gradeText ? (
          <span className="cd-display-name__meta">
            {" · "}
            {cardNumber ? `${cardNumber}${gradeText ? " · " : ""}` : null}
          </span>
        ) : null}
        {gradeText ? (
          <strong className="cd-display-name__grade">{gradeText}</strong>
        ) : null}
      </span>
    </Tag>
  );
}
