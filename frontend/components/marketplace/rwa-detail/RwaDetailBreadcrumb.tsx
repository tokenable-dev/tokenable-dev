"use client";

import Link from "next/link";

export function RwaDetailBreadcrumb({
  collectionHref,
  collectionLabel,
  tokenLabel,
}: {
  collectionHref?: string | null;
  collectionLabel?: string | null;
  tokenLabel: string;
}) {
  const collection = collectionLabel?.trim();
  const token = tokenLabel.trim();

  return (
    <nav className="rd-breadcrumb" aria-label="Breadcrumb">
      <Link href="/markets">Markets</Link>
      {collectionHref && collection ? (
        <>
          <span className="rd-breadcrumb__sep">/</span>
          <Link href={collectionHref}>{collection}</Link>
        </>
      ) : null}
      {token ? (
        <>
          <span className="rd-breadcrumb__sep">/</span>
          <span className="rd-breadcrumb__current">{token}</span>
        </>
      ) : null}
    </nav>
  );
}
