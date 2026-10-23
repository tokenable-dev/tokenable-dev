"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPricechartingCatalog,
  recordPricechartingHistory,
  searchPricechartingProducts,
  syncPricechartingGuide,
  uploadPricechartingCover,
  uploadPricechartingCsv,
  type ManualPriceHistoryResult,
  type PricechartingCatalogSummary,
  type PricechartingGuideSyncResult,
  type PricechartingImportResult,
  type PricechartingProductHit,
} from "@/lib/core/api/marketplace-admin-pricecharting";
import { AdminSectionTitle, AdminStatTile } from "./AdminAnalyticsWidgets";
import {
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_PANEL,
  ADMIN_STAT_CARD,
  ADMIN_TEXT_EMPTY,
  ADMIN_TEXT_ERROR,
  ADMIN_TEXT_META,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

/** Cent column → label. Order matches the CSV price columns. PSA 10 is manual-only. */
const HISTORY_PRICE_FIELDS: Array<[string, string]> = [
  ["loose_price_cents", "Loose"],
  ["cib_price_cents", "CIB"],
  ["new_price_cents", "New"],
  ["graded_price_cents", "Graded"],
  ["box_only_price_cents", "Box only"],
  ["manual_only_price_cents", "PSA 10"],
  ["bgs_10_price_cents", "BGS 10"],
  ["condition_9_price_cents", "Condition 9"],
  ["condition_10_price_cents", "Condition 10"],
  ["condition_13_price_cents", "Condition 13"],
  ["condition_14_price_cents", "Condition 14"],
  ["condition_15_price_cents", "Condition 15"],
  ["condition_16_price_cents", "Condition 16"],
  ["condition_17_price_cents", "Condition 17"],
  ["condition_18_price_cents", "Condition 18"],
  ["condition_19_price_cents", "Condition 19"],
  ["condition_20_price_cents", "Condition 20"],
  ["condition_21_price_cents", "Condition 21"],
  ["condition_22_price_cents", "Condition 22"],
  ["gamestop_price_cents", "GameStop"],
  ["gamestop_trade_price_cents", "GameStop trade"],
  ["retail_loose_buy_cents", "Retail loose buy"],
  ["retail_loose_sell_cents", "Retail loose sell"],
  ["retail_cib_buy_cents", "Retail CIB buy"],
  ["retail_cib_sell_cents", "Retail CIB sell"],
  ["retail_new_buy_cents", "Retail new buy"],
  ["retail_new_sell_cents", "Retail new sell"],
];

function formatGuideMeta(
  guide: NonNullable<PricechartingCatalogSummary["guides"]>[number],
  running: boolean,
): string {
  if (running) return "서버에서 다운로드·적재 중";
  if (guide.lastRunAt) {
    return `${guide.lastRowCount?.toLocaleString() ?? 0}행 · ${new Date(guide.lastRunAt).toLocaleString()}`;
  }
  return "아직 실행 전";
}

function ProductHitList({
  hits,
  selectedId,
  onSelect,
  showLoose,
}: {
  hits: PricechartingProductHit[];
  selectedId: string | null;
  onSelect: (hit: PricechartingProductHit) => void;
  showLoose?: boolean;
}) {
  return (
    <ul className="max-h-64 divide-y divide-zinc-100 overflow-y-auto rounded-md border border-zinc-200 bg-white">
      {hits.map((hit) => {
        const selected = selectedId === hit.id;
        const loose =
          showLoose && hit.loosePriceCents != null
            ? `Loose $${(hit.loosePriceCents / 100).toFixed(2)}`
            : null;
        return (
          <li key={hit.id}>
            <button
              type="button"
              className={`flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 ${
                selected ? "bg-zinc-50 ring-1 ring-inset ring-zinc-200" : ""
              }`}
              onClick={() => onSelect(hit)}
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  selected ? "bg-[var(--brand-500)]" : "bg-zinc-300"
                }`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-zinc-900">{hit.productName}</span>
                <span className={`mt-0.5 block text-xs ${ADMIN_TEXT_MUTED}`}>
                  {hit.consoleName}
                  {hit.genre ? ` · ${hit.genre}` : ""}
                  {loose ? ` · ${loose}` : ""}
                  {hit.coverImageUrl ? " · 커버 있음" : ""}
                  {" · "}
                  <span className="font-mono">{hit.id}</span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function MarketplaceAdminPricechartingPage() {
  const [summary, setSummary] = useState<PricechartingCatalogSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PricechartingImportResult | null>(null);
  const [guideResult, setGuideResult] = useState<PricechartingGuideSyncResult | null>(null);
  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyHits, setHistoryHits] = useState<PricechartingProductHit[] | null>(null);
  const [historyPick, setHistoryPick] = useState<PricechartingProductHit | null>(null);
  const [historySearchBusy, setHistorySearchBusy] = useState(false);
  const [historySearchError, setHistorySearchError] = useState<string | null>(null);
  const [historyProductId, setHistoryProductId] = useState("");
  const [historyDate, setHistoryDate] = useState("");
  const [historyPrices, setHistoryPrices] = useState<Record<string, string>>({});
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyResult, setHistoryResult] = useState<ManualPriceHistoryResult | null>(null);
  const [coverQuery, setCoverQuery] = useState("");
  const [coverHits, setCoverHits] = useState<PricechartingProductHit[] | null>(null);
  const [coverPick, setCoverPick] = useState<PricechartingProductHit | null>(null);
  const [coverSearchBusy, setCoverSearchBusy] = useState(false);
  const [coverSearchError, setCoverSearchError] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await getPricechartingCatalog();
      setSummary(next);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load catalog");
      return null;
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Resume polling if the page loads while a guide sync is already running.
  useEffect(() => {
    const running = summary?.guides.find((g) => g.syncStatus === "running");
    if (running && syncingKey !== running.key) {
      setSyncingKey(running.key);
    }
  }, [summary, syncingKey]);

  useEffect(() => {
    if (!syncingKey) return;
    let cancelled = false;
    const tick = async () => {
      const next = await reload();
      if (cancelled || !next) return;
      const guide = next.guides.find((g) => g.key === syncingKey);
      if (!guide || guide.syncStatus === "running") return;
      if (guide.syncStatus === "success" && guide.lastSyncResult) {
        setGuideResult(guide.lastSyncResult);
        setError(null);
      } else if (guide.syncStatus === "error") {
        setGuideResult(null);
        setError(guide.syncError || "Sync failed");
      }
      setSyncingKey(null);
    };
    const id = window.setInterval(() => {
      void tick();
    }, 2_000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [syncingKey, reload]);

  async function onSyncGuide(key: string) {
    setSyncingKey(key);
    setError(null);
    setGuideResult(null);
    try {
      await syncPricechartingGuide(key);
      // Polling effect watches syncingKey + catalog.syncStatus.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      setSyncingKey(null);
    }
  }

  async function onSearchHistory() {
    const q = historyQuery.trim();
    if (!q) return;
    setHistorySearchBusy(true);
    setHistorySearchError(null);
    setHistoryHits(null);
    try {
      setHistoryHits(await searchPricechartingProducts(q));
    } catch (err) {
      setHistorySearchError(err instanceof Error ? err.message : "Could not search");
    } finally {
      setHistorySearchBusy(false);
    }
  }

  function pickHistoryProduct(hit: PricechartingProductHit) {
    setHistoryPick(hit);
    setHistoryProductId(hit.id);
    setHistoryResult(null);
    setHistoryError(null);
  }

  async function onSearchCover() {
    const q = coverQuery.trim();
    if (!q) return;
    setCoverSearchBusy(true);
    setCoverSearchError(null);
    setCoverHits(null);
    try {
      setCoverHits(await searchPricechartingProducts(q));
    } catch (err) {
      setCoverSearchError(err instanceof Error ? err.message : "Could not search");
    } finally {
      setCoverSearchBusy(false);
    }
  }

  async function onUploadCover() {
    if (!coverPick || !coverFile || coverBusy) return;
    setCoverBusy(true);
    setCoverError(null);
    try {
      const saved = await uploadPricechartingCover(coverPick.id, coverFile);
      setCoverUrl(saved.coverImageUrl);
      setCoverPick({ ...coverPick, coverImageUrl: saved.coverImageUrl });
      setCoverFile(null);
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setCoverBusy(false);
    }
  }

  async function onSaveHistory() {
    const prices: Record<string, string> = {};
    for (const [column, value] of Object.entries(historyPrices)) {
      const trimmed = value.trim();
      if (trimmed) prices[column] = trimmed;
    }
    setHistoryBusy(true);
    setHistoryError(null);
    setHistoryResult(null);
    try {
      setHistoryResult(
        await recordPricechartingHistory({
          productId: historyProductId.trim(),
          observedOn: historyDate,
          prices,
        }),
      );
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Could not save prices");
    } finally {
      setHistoryBusy(false);
    }
  }

  async function onUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const imported = await uploadPricechartingCsv(file);
      setResult(imported);
      setFile(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const topGenres = (summary?.byGenre ?? []).slice(0, 6);
  const moreGenreCount = Math.max(0, (summary?.byGenre ?? []).length - topGenres.length);

  return (
    <article className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6">
      <MarketplaceAdminPageHeader
        title="PriceCharting catalog"
        subtitle="가이드 동기화 · 스포츠 CSV · 대표 이미지 · 날짜별 가격 입력"
      />

      <section className={`${ADMIN_PANEL} p-4 sm:p-5`}>
        <AdminSectionTitle
          title="카탈로그 현황"
          subtitle="로컬 DB에 적재된 PriceCharting 상품"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div className={ADMIN_STAT_CARD}>
            <AdminStatTile
              label="전체 상품"
              value={summary ? summary.totalProducts : "…"}
            />
          </div>
          {topGenres.map((row) => (
            <div key={row.genre} className={ADMIN_STAT_CARD}>
              <AdminStatTile label={row.genre} value={row.count} />
            </div>
          ))}
        </div>
        {moreGenreCount > 0 ? (
          <p className={`mt-3 text-xs ${ADMIN_TEXT_META}`}>
            외 {moreGenreCount}개 장르
          </p>
        ) : null}
      </section>

      <section className={`${ADMIN_PANEL} p-4 sm:p-5`}>
        <AdminSectionTitle
          title="가이드 갱신"
          subtitle="버튼 한 번으로 해당 가이드 CSV를 받아 최신 가격으로 갱신합니다. 큰 파일도 백그라운드에서 처리됩니다."
        />
        <ul className="space-y-2">
          {(summary?.guides ?? []).map((guide) => {
            const running =
              syncingKey === guide.key || guide.syncStatus === "running";
            return (
              <li
                key={guide.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50/60 px-3 py-3 sm:px-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900">{guide.label}</p>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        running
                          ? "bg-amber-100 text-amber-800"
                          : guide.lastRunAt
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {running ? "동기화 중" : guide.lastRunAt ? "동기화됨" : "대기"}
                    </span>
                  </div>
                  <p className={`mt-1 text-xs sm:text-sm ${ADMIN_TEXT_SECONDARY}`}>
                    {formatGuideMeta(guide, running)}
                  </p>
                </div>
                <button
                  type="button"
                  className={ADMIN_BTN_PRIMARY}
                  disabled={busy || syncingKey !== null}
                  onClick={() => void onSyncGuide(guide.key)}
                >
                  {running ? "받는 중…" : "갱신"}
                </button>
              </li>
            );
          })}
        </ul>
        {guideResult ? (
          <p className="mt-3 text-sm text-emerald-700">
            {guideResult.label}: {guideResult.rowCount.toLocaleString()}행 갱신 · 가격 이력{" "}
            {guideResult.historyCount.toLocaleString()}건 · 카탈로그{" "}
            {guideResult.totalProducts.toLocaleString()}
          </p>
        ) : null}
        {guideResult?.archiveError ? (
          <p className="mt-2 text-sm text-amber-700">
            Import succeeded, but raw CSV archival failed.
          </p>
        ) : null}
        {error ? <p className={`mt-3 ${ADMIN_TEXT_ERROR}`}>{error}</p> : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <section className={`${ADMIN_PANEL} p-4 sm:p-5`}>
          <AdminSectionTitle
            title="스포츠 CSV"
            subtitle="세트명으로 아카이브하고 id 기준 upsert. 가격은 센트 정수(PSA 10 = manual-only)."
          />
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer flex-col gap-2 rounded-md border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50">
              <span className={`text-xs font-medium ${ADMIN_TEXT_SECONDARY}`}>
                CSV / TSV 선택
              </span>
              <span className={`truncate text-sm ${file ? "text-zinc-900" : ADMIN_TEXT_EMPTY}`}>
                {file ? file.name : "파일을 선택하세요"}
              </span>
              <input
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              className={ADMIN_BTN_PRIMARY}
              disabled={!file || busy || syncingKey !== null}
              onClick={() => void onUpload()}
            >
              {busy ? "적재 중…" : "업로드"}
            </button>
            {error && !syncingKey ? (
              <p className={ADMIN_TEXT_ERROR}>{error}</p>
            ) : null}
            {result ? (
              <p className="text-sm text-emerald-700">
                {result.filename}: {result.rowCount.toLocaleString()}행 upsert
                {result.skipped ? ` · ${result.skipped}행 건너뜀` : ""} · 이력{" "}
                {result.historyCount.toLocaleString()}건
              </p>
            ) : null}
            {result?.archiveError ? (
              <p className="text-sm text-amber-700">
                Import succeeded, but raw CSV archival failed.
              </p>
            ) : null}
          </div>
        </section>

        <section className={`${ADMIN_PANEL} p-4 sm:p-5`}>
          <AdminSectionTitle title="최근 업로드" subtitle="가이드·수동 CSV 적재 이력" />
          <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {(summary?.recentRuns ?? []).slice(0, 8).map((run) => (
              <li key={run.id} className="px-3 py-2.5">
                <p className="truncate text-sm font-medium text-zinc-900">{run.filename}</p>
                <p className={`mt-0.5 text-xs ${ADMIN_TEXT_MUTED}`}>
                  {run.rowCount.toLocaleString()}행 · {new Date(run.createdAt).toLocaleString()}
                  {run.errorMessage ? (
                    <span className="text-amber-700"> · {run.errorMessage}</span>
                  ) : null}
                </p>
              </li>
            ))}
            {summary && summary.recentRuns.length === 0 ? (
              <li className={`px-3 py-4 text-sm ${ADMIN_TEXT_EMPTY}`}>아직 없습니다.</li>
            ) : null}
            {!summary ? (
              <li className={`px-3 py-4 text-sm ${ADMIN_TEXT_EMPTY}`}>불러오는 중…</li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className={`${ADMIN_PANEL} p-4 sm:p-5`}>
        <AdminSectionTitle
          title="박스 대표 이미지"
          subtitle="S3 URL을 cover_image_url에 저장합니다. CSV 재업로드에도 유지되며, 이미 민트된 박스는 바뀌지 않습니다."
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className={`${ADMIN_LABEL} mb-0 min-w-0 flex-1`}>
            카드 / 박스 이름
            <input
              className={`${ADMIN_INPUT} mt-1.5`}
              placeholder="예: Evolving Skies Booster Box"
              value={coverQuery}
              onChange={(e) => setCoverQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSearchCover();
              }}
            />
          </label>
          <button
            type="button"
            className={ADMIN_BTN_SECONDARY}
            disabled={coverSearchBusy || !coverQuery.trim()}
            onClick={() => void onSearchCover()}
          >
            {coverSearchBusy ? "찾는 중…" : "찾기"}
          </button>
        </div>
        {coverSearchError ? <p className={`mt-3 ${ADMIN_TEXT_ERROR}`}>{coverSearchError}</p> : null}
        {coverHits ? (
          <div className="mt-3 space-y-2">
            {coverHits.length === 0 ? (
              <p className={`text-sm ${ADMIN_TEXT_EMPTY}`}>맞는 상품이 없습니다.</p>
            ) : (
              <ProductHitList
                hits={coverHits}
                selectedId={coverPick?.id ?? null}
                onSelect={(hit) => {
                  setCoverPick(hit);
                  setCoverUrl(hit.coverImageUrl ?? null);
                  setCoverError(null);
                  setCoverFile(null);
                }}
              />
            )}
          </div>
        ) : null}
        {coverPick ? (
          <div className="mt-4 grid gap-4 rounded-md border border-zinc-200 bg-zinc-50/60 p-3 sm:grid-cols-[auto_1fr] sm:p-4">
            <div className="flex h-28 w-24 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-white">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className={`px-2 text-center text-[11px] ${ADMIN_TEXT_EMPTY}`}>
                  No cover
                </span>
              )}
            </div>
            <div className="min-w-0 space-y-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">{coverPick.productName}</p>
                <p className={`mt-0.5 text-xs ${ADMIN_TEXT_MUTED}`}>
                  {coverPick.consoleName} · <span className="font-mono">{coverPick.id}</span>
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50">
                  {coverFile ? coverFile.name : "JPEG / PNG / WebP 선택"}
                  <input
                    key={`${coverPick.id}:${coverUrl ?? ""}`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button
                  type="button"
                  className={ADMIN_BTN_PRIMARY}
                  disabled={coverBusy || !coverFile}
                  onClick={() => void onUploadCover()}
                >
                  {coverBusy ? "올리는 중…" : "대표 이미지 저장"}
                </button>
              </div>
              {coverError ? <p className={ADMIN_TEXT_ERROR}>{coverError}</p> : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className={`${ADMIN_PANEL} p-4 sm:p-5`}>
        <AdminSectionTitle
          title="과거 가격 입력"
          subtitle="상품을 고른 뒤 날짜와 달러 가격만 넣습니다. 빈 칸은 유지되고, 카탈로그 최신가는 바뀌지 않습니다."
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className={`${ADMIN_LABEL} mb-0 min-w-0 flex-1`}>
            카드 / 박스 이름
            <input
              className={`${ADMIN_INPUT} mt-1.5`}
              placeholder="예: Scarlet Violet 151 Booster Box"
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSearchHistory();
              }}
            />
          </label>
          <button
            type="button"
            className={ADMIN_BTN_SECONDARY}
            disabled={historySearchBusy || !historyQuery.trim()}
            onClick={() => void onSearchHistory()}
          >
            {historySearchBusy ? "찾는 중…" : "찾기"}
          </button>
        </div>
        {historySearchError ? (
          <p className={`mt-3 ${ADMIN_TEXT_ERROR}`}>{historySearchError}</p>
        ) : null}
        {historyHits ? (
          <div className="mt-3 space-y-2">
            {historyHits.length === 0 ? (
              <p className={`text-sm ${ADMIN_TEXT_EMPTY}`}>맞는 상품이 없습니다.</p>
            ) : (
              <ProductHitList
                hits={historyHits}
                selectedId={historyPick?.id ?? null}
                onSelect={pickHistoryProduct}
                showLoose
              />
            )}
            {historyHits.length === 20 ? (
              <p className={`text-xs ${ADMIN_TEXT_META}`}>
                20개까지만 표시합니다. 세트 이름을 더 적으면 목록이 줄어듭니다.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={ADMIN_LABEL}>
            상품 id
            <input
              className={`${ADMIN_INPUT} mt-1.5 font-mono`}
              inputMode="numeric"
              value={historyProductId}
              onChange={(e) => {
                const next = e.target.value;
                setHistoryProductId(next);
                if (historyPick && historyPick.id !== next.trim()) setHistoryPick(null);
              }}
            />
            {historyPick && historyPick.id === historyProductId.trim() ? (
              <span className={`mt-1 block text-xs font-normal ${ADMIN_TEXT_MUTED}`}>
                {historyPick.productName} · {historyPick.consoleName}
              </span>
            ) : null}
          </label>
          <label className={ADMIN_LABEL}>
            날짜
            <input
              type="date"
              className={`${ADMIN_INPUT} mt-1.5`}
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4">
          <p className={`mb-2 text-xs font-medium uppercase tracking-wide ${ADMIN_TEXT_MUTED}`}>
            가격 (달러 · 비우면 유지)
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {HISTORY_PRICE_FIELDS.map(([column, label]) => (
              <label key={column} className={ADMIN_LABEL}>
                {label}
                <input
                  className={`${ADMIN_INPUT} mt-1.5 font-mono`}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={historyPrices[column] ?? ""}
                  onChange={(e) =>
                    setHistoryPrices((prev) => ({ ...prev, [column]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
          <button
            type="button"
            className={ADMIN_BTN_PRIMARY}
            disabled={historyBusy || !historyProductId.trim() || !historyDate}
            onClick={() => void onSaveHistory()}
          >
            {historyBusy ? "저장 중…" : "이 날짜 가격 저장"}
          </button>
          {historyError ? <p className={ADMIN_TEXT_ERROR}>{historyError}</p> : null}
          {historyResult ? (
            <p className="text-sm text-emerald-700">
              {historyResult.productName} ({historyResult.productId}) · {historyResult.observedOn}{" "}
              · {Object.keys(historyResult.savedCents).length}개 저장
            </p>
          ) : null}
        </div>
      </section>
    </article>
  );
}
