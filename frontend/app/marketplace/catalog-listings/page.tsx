"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CatalogListingSummary } from "@/components/sell/CatalogListingSummary";
import {
  submittedCatalogListings,
  type CatalogListing,
} from "@/lib/core/api/pricecharting-listings";
import "@/styles/tokenable-sell-flow.css";

export default function CatalogListingsPage() {
  const [rows, setRows] = useState<CatalogListing[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void submittedCatalogListings()
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load listings");
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="sell-flow-page sell-flow-page--catalog">
      <section className="sell-flow-screen sell-flow-choice">
        <div className="sell-flow-col sell-flow-col--choice">
          <h1 className="sell-flow-choice__title">Catalog listings</h1>
          <p>
            These are seller listings for catalog items. The loose price is a reference. There is no checkout
            on this page.
          </p>
          {error ? (
            <p className="sell-catalog-alert" role="alert">
              {error}
            </p>
          ) : null}
          {!loaded ? <p>Loading…</p> : null}
          {loaded && !rows.length ? <p>No submitted catalog listings.</p> : null}
          <ul className="sell-catalog-list">
            {rows.map((row) => (
              <li key={row.id}>
                <CatalogListingSummary listing={row} href={`/marketplace/catalog-listings/${row.id}`} />
              </li>
            ))}
          </ul>
          <p>
            <Link href="/markets" className="sell-flow-link">
              Back to Markets
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
