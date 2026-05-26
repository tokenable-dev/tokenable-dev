"use client";

import {
  assetDetailHeadlineHasContent,
  formatAssetDetailHeadlineText,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";

export function AssetDetailHeadlineTitle({
  parts,
  className,
  as: Tag = "span",
}: {
  parts: AssetDetailHeadlineParts;
  className?: string;
  as?: "h1" | "h2" | "p" | "span";
}) {
  if (!assetDetailHeadlineHasContent(parts)) return null;

  const segments = [parts.year, parts.setName, parts.cardName].filter(
    (s): s is string => Boolean(s?.trim()),
  );
  const fullTitle = formatAssetDetailHeadlineText(parts);

  return (
    <Tag className={className} title={fullTitle}>
      {segments.map((segment, index) => (
        <span key={`${index}-${segment}`}>
          {index > 0 ? " " : null}
          {segment}
        </span>
      ))}
    </Tag>
  );
}
