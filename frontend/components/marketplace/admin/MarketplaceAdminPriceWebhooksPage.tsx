"use client";

import { useState } from "react";
import { useCardhedgerPriceInfraAdmin } from "@/hooks/marketplace-admin/useCardhedgerPriceInfraAdmin";
import type { DeltaImportRun } from "@/lib/core/api/marketplace-admin-cardhedger";
import { ADMIN_ARTICLE, ADMIN_BTN_PRIMARY, ADMIN_PANEL, ADMIN_TEXT_BRAND } from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

function FlagPill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium sm:text-sm ${
        on
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200"
      }`}
    >
      {label}: {on ? "on" : "off"}
    </span>
  );
}

function DeltaRunDetail({
  run,
  defaultOpen = false,
}: {
  run: DeltaImportRun;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`${ADMIN_PANEL} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left sm:px-5 sm:py-4"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 sm:text-base">
            {new Date(run.ranAt).toLocaleString()} · {run.status}
          </p>
          <p className="mt-1.5 text-xs text-zinc-600 sm:text-sm">
            Checkpoint{" "}
            <span className="font-mono text-zinc-700">{run.sinceIso}</span>
            {run.latestTimestampIso ? (
              <>
                {" "}
                → <span className="font-mono text-zinc-700">{run.latestTimestampIso}</span>
              </>
            ) : null}
          </p>
          <p className="mt-2 text-xs text-zinc-600 sm:text-sm">
            <span className="font-medium text-emerald-700">{run.matchedCollectionCount}</span>{" "}
            collections queued
            {run.catalogFallbackCount > 0 ? (
              <>
                {" "}
                (<span className={ADMIN_TEXT_BRAND}>{run.catalogFallbackCount}</span> catalog sync)
              </>
            ) : null}
            {run.deltaMatchedCollectionCount > 0 ? (
              <>
                {" "}
                · <span className="text-emerald-700">{run.deltaMatchedCollectionCount}</span> from
                delta match
              </>
            ) : null}
          </p>
        </div>
        <span className="shrink-0 text-sm text-zinc-600">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-zinc-200 px-4 py-4 sm:px-5">
          {run.matchedCollections.length > 0 ? (
            <ul className="space-y-2">
              {run.matchedCollections.map((row) => (
                <li
                  key={row.collectionKey}
                  className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 sm:text-sm"
                >
                  <span className="font-mono font-medium text-zinc-900">{row.collectionKey}</span>
                  {row.cardDesc ? (
                    <span className="text-zinc-600"> — {row.cardDesc}</span>
                  ) : (
                    <span className="text-zinc-600"> — catalog sync</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-amber-700">No collections were queued.</p>
          )}

          {run.errorMessage ? (
            <p className="text-xs text-red-600">{run.errorMessage}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MarketplaceAdminPriceWebhooksPage() {
  const { statusQuery, deltaMutation } = useCardhedgerPriceInfraAdmin();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);

  const status = statusQuery.data;
  const busy = deltaMutation.isPending;

  const runDelta = async () => {
    setActionMessage(null);
    try {
      const result = await deltaMutation.mutateAsync();
      if (!result.ok) {
        setActionMessage("Sync skipped — another run is in flight.");
        return;
      }
      const d = result.delta;
      if (!d) {
        setActionMessage("Price sync is disabled.");
        return;
      }
      setExpandedRunId(d.id);
      setActionMessage(
        `${d.matchedCollectionCount} collection(s) queued. Snapshots refresh in the background (about 1–2 min).`,
      );
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Sync failed");
    }
  };

  const runs = status?.recentDeltaRuns ?? [];

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Price sync"
        subtitle="Cardhedger 시세를 DB snapshot에 반영합니다. Markets·Portfolio 가격이 이 snapshot을 읽습니다."
      />

      {statusQuery.isLoading ? (
        <p className="text-sm text-zinc-700">Loading…</p>
      ) : statusQuery.isError ? (
        <p className="text-sm text-red-600" role="alert">
          {statusQuery.error instanceof Error
            ? statusQuery.error.message
            : "Failed to load status"}
        </p>
      ) : status ? (
        <div className="space-y-5 sm:space-y-6">
          <section className={ADMIN_ARTICLE}>
            <h2 className="text-base font-semibold text-zinc-900">Automation</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <FlagPill on={status.flags.dailyPriceDeltaImportEnabled} label="Sync enabled" />
              <FlagPill on={status.deltaCronEnabled} label="Nightly cron" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-zinc-600">
              {status.deltaCronEnabled ? (
                <>
                  Production: 매일 <strong className="text-zinc-800">04:00 KST</strong>에 자동
                  실행됩니다.
                </>
              ) : (
                <>
                  Dev: nightly cron은 꺼져 있습니다. 지금은{" "}
                  <strong className="text-zinc-800">Run price sync now</strong>로 수동 실행하거나,
                  production 배포 시 cron이 켜집니다.
                </>
              )}{" "}
              수동 실행 시 Cardhedger-linked collection 전체를 갱신합니다.
            </p>
          </section>

          <section className={ADMIN_ARTICLE}>
            <h2 className="text-base font-semibold text-zinc-900">Run price sync</h2>
            <button
              type="button"
              disabled={busy || !status.flags.dailyPriceDeltaImportEnabled}
              onClick={() => void runDelta()}
              className={`${ADMIN_BTN_PRIMARY} mt-4`}
            >
              {deltaMutation.isPending ? "Running…" : "Run price sync now"}
            </button>
            {actionMessage ? (
              <p className="mt-4 text-sm text-zinc-700" role="status">
                {actionMessage}
              </p>
            ) : null}
          </section>

          {runs.length > 0 ? (
            <section className={ADMIN_ARTICLE}>
              <h2 className="text-base font-semibold text-zinc-900">Sync history</h2>
              <p className="mt-2 text-sm text-zinc-700">
                펼치면 snapshot refresh가 큐에 들어간 collection 목록을 볼 수 있습니다.
              </p>
              <div className="mt-4 space-y-3">
                {runs.map((run) => (
                  <DeltaRunDetail
                    key={run.id}
                    run={run}
                    defaultOpen={expandedRunId === run.id}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
