"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMarketplaceAdminDataInventory } from "@/hooks/marketplace-admin/useMarketplaceAdminDataInventory";
import type {
  DataInventoryDomainId,
  DataStoreInventoryRow,
} from "@/lib/core/api/marketplace-admin-data-inventory";
import { AdminSectionTitle, AdminStatTile } from "./AdminAnalyticsWidgets";
import {
  ADMIN_ARTICLE,
  ADMIN_LINK,
  ADMIN_PANEL,
  ADMIN_TEXT_META,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatHighlightKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function highlightEntries(
  highlights: DataStoreInventoryRow["highlights"],
): [string, string | number | boolean | null][] {
  return Object.entries(highlights).filter(([, v]) => v != null && v !== "");
}

function DataStoreCard({ store }: { store: DataStoreInventoryRow }) {
  const [open, setOpen] = useState(false);
  const extras = highlightEntries(store.highlights);

  return (
    <div className={`${ADMIN_PANEL} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left sm:px-5 sm:py-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-zinc-900 sm:text-base">
              {store.label}
            </p>
            <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600">
              {store.table}
            </span>
          </div>
          <p className={`mt-1.5 text-xs sm:text-sm ${ADMIN_TEXT_SECONDARY}`}>
            {store.rowCount.toLocaleString()} rows
            {store.lastActivityAt ? (
              <>
                {" "}
                · last activity{" "}
                <span className="font-medium text-zinc-800">
                  {formatWhen(store.lastActivityAt)}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <span className={`shrink-0 text-sm ${ADMIN_TEXT_MUTED}`}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-zinc-200 px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              What is stored
            </p>
            <p className={`mt-1.5 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
              {store.description}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              How it accumulates
            </p>
            <p className={`mt-1.5 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
              {store.howAccumulated}
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-zinc-50 px-3 py-2">
              <dt className={`text-xs ${ADMIN_TEXT_META}`}>Oldest record</dt>
              <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                {formatWhen(store.oldestAt)}
              </dd>
            </div>
            <div className="rounded-md bg-zinc-50 px-3 py-2">
              <dt className={`text-xs ${ADMIN_TEXT_META}`}>Newest record</dt>
              <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                {formatWhen(store.newestAt)}
              </dd>
            </div>
            <div className="rounded-md bg-zinc-50 px-3 py-2">
              <dt className={`text-xs ${ADMIN_TEXT_META}`}>Row count</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold text-zinc-900">
                {store.rowCount.toLocaleString()}
              </dd>
            </div>
          </dl>

          {extras.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Highlights
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {extras.map(([key, value]) => (
                  <li
                    key={key}
                    className="rounded-md bg-zinc-50 px-3 py-2 text-xs sm:text-sm"
                  >
                    <span className={ADMIN_TEXT_META}>{formatHighlightKey(key)}</span>
                    <span className="ml-2 font-medium text-zinc-900">
                      {typeof value === "number" ? value.toLocaleString() : String(value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {store.adminPagePath ? (
            <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>
              Related admin page:{" "}
              <Link href={store.adminPagePath} className={ADMIN_LINK}>
                {store.adminPagePath.replace("/marketplace/admin/", "")}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MarketplaceAdminDataInventoryPage() {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useMarketplaceAdminDataInventory();
  const [domainFilter, setDomainFilter] = useState<DataInventoryDomainId | "all">(
    "all",
  );

  const storesByDomain = useMemo(() => {
    if (!data) return new Map<DataInventoryDomainId, DataStoreInventoryRow[]>();
    const map = new Map<DataInventoryDomainId, DataStoreInventoryRow[]>();
    for (const store of data.stores) {
      const list = map.get(store.domain) ?? [];
      list.push(store);
      map.set(store.domain, list);
    }
    return map;
  }, [data]);

  const visibleDomains =
    domainFilter === "all"
      ? (data?.domains ?? [])
      : (data?.domains.filter((d) => d.id === domainFilter) ?? []);

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Data inventory"
        subtitle="PostgreSQL stores accumulated over time — what each table holds, how rows are written, and current freshness."
      />

      <div className={`${ADMIN_ARTICLE} mb-5 flex flex-wrap items-center gap-3`}>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
        {data?.generatedAt ? (
          <span className={`text-xs ${ADMIN_TEXT_META}`}>
            Generated {new Date(data.generatedAt).toLocaleString()}
          </span>
        ) : null}
      </div>

      {isError ? (
        <div className={`${ADMIN_ARTICLE} mb-5 text-sm text-red-600`}>
          {(error as Error).message}
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className={`${ADMIN_ARTICLE} text-sm text-zinc-700`}>
          Loading data inventory…
        </div>
      ) : null}

      {data ? (
        <>
          <div className={`${ADMIN_ARTICLE} mb-6`}>
            <AdminSectionTitle
              title="At a glance"
              subtitle="Total rows across tracked stores (not deduplicated by business entity)"
            />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <AdminStatTile label="Tracked stores" value={data.totals.storeCount} />
              <AdminStatTile
                label="Total rows"
                value={data.totals.rowCount.toLocaleString()}
              />
              <AdminStatTile
                label="Catalog rows"
                value={(storesByDomain.get("catalog") ?? [])
                  .reduce((s, r) => s + r.rowCount, 0)
                  .toLocaleString()}
              />
              <AdminStatTile
                label="Markets rows"
                value={(storesByDomain.get("markets") ?? [])
                  .reduce((s, r) => s + r.rowCount, 0)
                  .toLocaleString()}
              />
            </div>
          </div>

          <div className={`${ADMIN_ARTICLE} mb-6`}>
            <AdminSectionTitle
              title="Filter by domain"
              subtitle="Each domain maps to an operational area in the admin console"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDomainFilter("all")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  domainFilter === "all"
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                All
              </button>
              {data.domains.map((domain) => (
                <button
                  key={domain.id}
                  type="button"
                  onClick={() => setDomainFilter(domain.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    domainFilter === domain.id
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {domain.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            {visibleDomains.map((domain) => {
              const stores = storesByDomain.get(domain.id) ?? [];
              const domainRows = stores.reduce((s, r) => s + r.rowCount, 0);
              return (
                <section key={domain.id}>
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-zinc-900">
                      {domain.label}
                    </h2>
                    <p className={`mt-1 max-w-3xl text-sm ${ADMIN_TEXT_SECONDARY}`}>
                      {domain.summary}
                    </p>
                    <p className={`mt-1 text-xs ${ADMIN_TEXT_META}`}>
                      {stores.length} stores · {domainRows.toLocaleString()} rows
                    </p>
                  </div>
                  <div className="space-y-3">
                    {stores.map((store) => (
                      <DataStoreCard key={store.id} store={store} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <div className={`${ADMIN_ARTICLE} mt-8 ${ADMIN_TEXT_SECONDARY} text-sm`}>
            <AdminSectionTitle title="How to read this page" />
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong>Append-only</strong> tables (Top 100 snapshots, delta import
                runs, KYC events) grow one row per day or event — history is preserved.
              </li>
              <li>
                <strong>Upsert / refresh</strong> tables (collection market snapshots)
                keep one row per key but overwrite prices and JSON payloads on sync.
              </li>
              <li>
                PSA cert metadata lives inside{" "}
                <code className="font-mono text-xs">marketplace_collections.components</code>{" "}
                — fetched live on mint, not a separate snapshot table.
              </li>
              <li>
                For Cardhedger sync history details, see{" "}
                <Link href="/marketplace/admin/price-webhooks" className={ADMIN_LINK}>
                  Price sync
                </Link>
                . For portfolio cron rules, see{" "}
                <Link href="/marketplace/admin/portfolio" className={ADMIN_LINK}>
                  Portfolio ops
                </Link>
                .
              </li>
            </ul>
          </div>
        </>
      ) : null}
    </>
  );
}
