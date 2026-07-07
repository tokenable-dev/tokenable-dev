"use client";

import Link from "next/link";

export function CollectionDetailBreadcrumb({
  categoryLabel,
  trailLabel,
}: {
  categoryLabel?: string | null;
  trailLabel: string;
}) {
  const category = categoryLabel?.trim();
  const trail = trailLabel.trim();

  return (
    <nav className="cd-breadcrumb" aria-label="Breadcrumb">
      <Link href="/markets">Markets</Link>
      {category ? (
        <>
          <span className="cd-breadcrumb__sep">/</span>
          <span>{category}</span>
        </>
      ) : null}
      {trail ? (
        <>
          <span className="cd-breadcrumb__sep">/</span>
          <span className="cd-breadcrumb__current">{trail}</span>
        </>
      ) : null}
    </nav>
  );
}
