"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TkButton } from "@/components/ds";
import { CatalogListingSummary } from "@/components/sell/CatalogListingSummary";
import { VaultAuthGate } from "@/components/vault/VaultAuthGate";
import {
  cancelCatalogListing,
  myCatalogListings,
  type CatalogListing,
} from "@/lib/core/api/pricecharting-listings";
import "@/styles/tokenable-sell-flow.css";

function MyCatalogListings() {
  const [rows, setRows] = useState<CatalogListing[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void myCatalogListings()
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

  async function onCancel(id: string) {
    setPendingId(id);
    setError(null);
    try {
      await cancelCatalogListing(id);
      setRows((current) => current.filter((row) => row.id !== id));
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel the listing");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="sell-flow-screen sell-flow-choice">
      <div className="sell-flow-col sell-flow-col--choice">
        <p>
          <Link href="/vault" className="sell-flow-link">
            Back to Sell
          </Link>
        </p>
        <h1 className="sell-flow-choice__title">Your catalog listings</h1>
        <p>Asking prices stay separate from the loose price. Cancelling removes a listing from buyers.</p>
        <p>
          <Link href="/sell/catalog" className="sell-flow-link">
            List a catalog item
          </Link>
        </p>
        {error ? (
          <p className="sell-catalog-alert" role="alert">
            {error}
          </p>
        ) : null}
        {!loaded ? <p>Loading…</p> : null}
        {loaded && !rows.length ? <p>You have no catalog listings.</p> : null}
        <ul className="sell-catalog-list">
          {rows.map((row) => (
            <li key={row.id}>
              <CatalogListingSummary
                listing={row}
                showStatus
                href={row.status === "submitted" ? `/marketplace/catalog-listings/${row.id}` : undefined}
              >
                {confirmId === row.id ? (
                  <div className="sell-catalog-actions">
                    <TkButton
                      type="button"
                      variant="danger"
                      disabled={pendingId === row.id}
                      onClick={() => void onCancel(row.id)}
                    >
                      {pendingId === row.id ? "Cancelling…" : "Cancel listing"}
                    </TkButton>
                    <TkButton
                      type="button"
                      variant="subtle"
                      disabled={pendingId === row.id}
                      onClick={() => setConfirmId(null)}
                    >
                      Keep
                    </TkButton>
                  </div>
                ) : (
                  <div className="sell-catalog-actions">
                    <TkButton type="button" variant="subtle" onClick={() => setConfirmId(row.id)}>
                      Cancel
                    </TkButton>
                  </div>
                )}
              </CatalogListingSummary>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function MyCatalogListingsPage() {
  return (
    <div className="sell-flow-page sell-flow-page--catalog">
      <VaultAuthGate>
        <MyCatalogListings />
      </VaultAuthGate>
    </div>
  );
}
