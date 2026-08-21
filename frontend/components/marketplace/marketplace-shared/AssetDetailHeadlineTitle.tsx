"use client";

import {
  assetDetailHeadlineHasContent,
  formatCardDisplayHoverTitle,
  formatCardDisplayName,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";

/**
 * Collection / RWA hero title — Display name = Character · Variant.
 * Full Display+Meta string stays on `title` for hover / accessibility.
 */
export function AssetDetailHeadlineTitle({
  parts,
  className,
  style,
  as: Tag = "span",
  grade,
}: {
  parts: AssetDetailHeadlineParts;
  className?: string;
  style?: React.CSSProperties;
  as?: "h1" | "h2" | "p" | "span";
  /** Optional grade for hover tooltip meta (Year · Set · # · Grade). */
  grade?: string | null;
}) {
  if (!assetDetailHeadlineHasContent(parts)) return null;

  const displayName = formatCardDisplayName(parts);
  if (!displayName) return null;

  const hover = formatCardDisplayHoverTitle(parts, { grade });
  const name = parts.cardName?.trim() || "";
  const variety = parts.variety?.trim() || "";

  return (
    <Tag className={className} style={style} title={hover || displayName}>
      <span className="block min-w-0 whitespace-normal [overflow-wrap:anywhere]">
        {name && variety ? (
          <>
            {name}
            <span className="cd-display-name__variant"> · {variety}</span>
          </>
        ) : (
          displayName
        )}
      </span>
    </Tag>
  );
}
