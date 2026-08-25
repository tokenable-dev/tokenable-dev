"use client";

import {
  assetDetailHeadlineHasContent,
  formatCardDisplayHoverTitle,
  formatCardDisplayName,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";

/**
 * Collection / RWA hero title — Card.html `#hero-title`:
 * `{Name}[ · Variant] · {Number} · {Grade}` with muted mid + strong grade.
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
  /** Optional grade for hover tooltip meta (Year · Set · # · Grade). */
  grade?: string | null;
  id?: string;
}) {
  if (!assetDetailHeadlineHasContent(parts)) return null;

  const displayName = formatCardDisplayName(parts);
  if (!displayName) return null;

  const hover = formatCardDisplayHoverTitle(parts, { grade });
  const name = parts.cardName?.trim() || "";
  const variety = parts.variety?.trim() || "";
  const cardNumber = parts.cardNumber?.trim() || "";
  const gradeText = grade?.trim() || "";

  return (
    <Tag className={className} style={style} title={hover || displayName} id={id}>
      <span className="block min-w-0 whitespace-normal [overflow-wrap:anywhere]">
        {name ? (
          <>
            {name}
            {variety ? (
              <span className="cd-display-name__variant"> · {variety}</span>
            ) : null}
          </>
        ) : (
          displayName
        )}
        {cardNumber || gradeText ? (
          <span className="cd-display-name__meta">
            {" · "}
            {cardNumber ? `${cardNumber} · ` : null}
          </span>
        ) : null}
        {gradeText ? (
          <strong className="cd-display-name__grade">{gradeText}</strong>
        ) : null}
      </span>
    </Tag>
  );
}
