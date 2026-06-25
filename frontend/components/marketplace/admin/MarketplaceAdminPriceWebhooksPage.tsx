"use client";

import { useState } from "react";
import { useCardhedgerPriceInfraAdmin } from "@/hooks/marketplace-admin/useCardhedgerPriceInfraAdmin";
import type { DeltaImportRun } from "@/lib/core/api/marketplace-admin-cardhedger";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_PRIMARY,
  ADMIN_PAGE_WIDE,
  ADMIN_PAGE_TITLE,
} from "./adminUi";
import { MarketplaceAdminNav } from "./MarketplaceAdminNav";

function FlagPill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wide sm:text-sm ${
        on ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"
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
    <div className="rounded-xl border border-zinc-800/80 bg-black/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left sm:px-5 sm:py-4"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-200 sm:text-base">
            {new Date(run.ranAt).toLocaleString()} · {run.status}
          </p>
          <p className="mt-1.5 text-xs text-zinc-500 sm:text-sm">
            Checkpoint{" "}
            <span className="font-mono text-zinc-400">{run.sinceIso}</span>
            {run.latestTimestampIso ? (
              <>
                {" "}
                → <span className="font-mono text-zinc-400">{run.latestTimestampIso}</span>
              </>
            ) : null}
          </p>
          <p className="mt-2 text-xs text-zinc-400 sm:text-sm">
            <span className="text-emerald-400">{run.matchedCollectionCount}</span> collections
            queued for snapshot refresh
            {run.catalogFallbackCount > 0 ? (
              <>
                {" "}
                (<span className="text-sky-400">{run.catalogFallbackCount}</span> catalog sync)
              </>
            ) : null}
            {run.deltaMatchedCollectionCount > 0 ? (
              <>
                {" "}
                · <span className="text-emerald-400">{run.deltaMatchedCollectionCount}</span> from
                delta match
              </>
            ) : null}
          </p>
        </div>
        <span className="shrink-0 text-sm text-zinc-600">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-zinc-800/60 px-4 py-4 sm:px-5">
          {run.matchedCollections.length > 0 ? (
            <ul className="space-y-2">
              {run.matchedCollections.map((row) => (
                <li
                  key={row.collectionKey}
                  className="rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400 sm:text-sm"
                >
                  <span className="font-mono font-semibold text-zinc-200">{row.collectionKey}</span>
                  {row.cardDesc ? (
                    <span className="text-zinc-500"> — {row.cardDesc}</span>
                  ) : (
                    <span className="text-zinc-500"> — catalog sync</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-amber-400/90">
              No collections were queued.
            </p>
          )}

          {run.errorMessage ? (
            <p className="text-[10px] text-red-400">{run.errorMessage}</p>
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
    <div className={ADMIN_PAGE_WIDE}>
      <MarketplaceAdminNav />

      <header className="mb-8">
        <h1 className={ADMIN_PAGE_TITLE}>Price sync</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400 sm:text-base">
          Cardhedger 시세를 DB snapshot에 반영합니다. Markets collection 가격·차트와 Portfolio
          카드 가격이 이 snapshot을 읽습니다. 페이지를 열 때마다 Cardhedger를 호출하지 않도록
          미리 저장해 두는 용도입니다.
        </p>
      </header>

      {statusQuery.isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : statusQuery.isError ? (
        <p className="text-sm text-red-400" role="alert">
          {statusQuery.error instanceof Error
            ? statusQuery.error.message
            : "Failed to load status"}
        </p>
      ) : status ? (
        <div className="space-y-6">
          <section className={ADMIN_ARTICLE}>
            <h2 className="text-base font-semibold text-zinc-200 sm:text-lg">Automation</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <FlagPill on={status.flags.dailyPriceDeltaImportEnabled} label="Sync enabled" />
              <FlagPill on={status.deltaCronEnabled} label="Nightly cron" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              {status.deltaCronEnabled ? (
                <>
                  Production: 매일 <strong className="text-zinc-300">04:00 KST</strong>에 자동
                  실행됩니다.
                </>
              ) : (
                <>
                  Dev: nightly cron은 꺼져 있습니다. 지금은{" "}
                  <strong className="text-zinc-300">Run price sync now</strong>로 수동 실행하거나,
                  production 배포 시 cron이 켜집니다.
                </>
              )}
              {" "}
              수동 실행 시 Cardhedger-linked collection 전체를 갱신합니다.
            </p>
          </section>

          <section className={ADMIN_ARTICLE}>
            <h2 className="text-base font-semibold text-zinc-200 sm:text-lg">Run price sync</h2>
            <button
              type="button"
              disabled={busy || !status.flags.dailyPriceDeltaImportEnabled}
              onClick={() => void runDelta()}
              className={`${ADMIN_BTN_PRIMARY} mt-5`}
            >
              {deltaMutation.isPending ? "Running…" : "Run price sync now"}
            </button>
            {actionMessage ? (
              <p className="mt-4 text-sm text-zinc-300" role="status">
                {actionMessage}
              </p>
            ) : null}
          </section>

          {runs.length > 0 ? (
            <section className={ADMIN_ARTICLE}>
              <h2 className="text-base font-semibold text-zinc-200 sm:text-lg">Sync history</h2>
              <p className="mt-2 text-sm text-zinc-500">
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
    </div>
  );
}
