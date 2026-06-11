"use client";

import {
  assetDetailHeadlineHasContent,
  formatAssetDetailHeadlineText,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";

export function AssetDetailHeadlineTitle({
  parts,
  className,
  style,
  as: Tag = "span",
}: {
  parts: AssetDetailHeadlineParts;
  className?: string;
  style?: React.CSSProperties;
  as?: "h1" | "h2" | "p" | "span";
}) {
  if (!assetDetailHeadlineHasContent(parts)) return null;

  const fullTitle = formatAssetDetailHeadlineText(parts);

  return (
    <Tag className={className} style={style} title={fullTitle}>
      <span className="block min-w-0 whitespace-normal [overflow-wrap:anywhere]">
        {fullTitle}
      </span>
    </Tag>
  );
}
