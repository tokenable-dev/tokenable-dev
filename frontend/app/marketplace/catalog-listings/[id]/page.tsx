"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CollectionDetailsScrollScope } from "@/app/marketplace/collections/[collectionKey]/CollectionDetailsScrollScope";
import { CatalogBoxDetail } from "@/components/sell/CatalogBoxDetail";
import { CollectionDetailStateShell } from "@/components/marketplace/collection-detail";
import "@/styles/tokenable-collection-detail.css";
import {
  submittedCatalogListing,
  type CatalogListingDetail,
} from "@/lib/core/api/pricecharting-listings";

export default function CatalogListingDetailPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<CatalogListingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    void submittedCatalogListing(params.id)
      .then((next) => {
        if (!cancelled) setRow(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "";
        setError(/not found|uuid/i.test(message) ? "Listing not found" : message || "Listing not found");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (error) {
    return (
      <CollectionDetailStateShell>
        <CollectionDetailsScrollScope />
        <p role="alert">{error}</p>
        <p className="mt-3">
          <Link href="/marketplace/catalog-listings">All catalog listings</Link>
        </p>
      </CollectionDetailStateShell>
    );
  }

  if (!row) {
    return (
      <CollectionDetailStateShell>
        <CollectionDetailsScrollScope />
        <p>Loading…</p>
      </CollectionDetailStateShell>
    );
  }

  return (
    <>
      <CollectionDetailsScrollScope />
      <CatalogBoxDetail listing={row} />
    </>
  );
}