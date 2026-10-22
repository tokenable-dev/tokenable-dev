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
import { ADMIN_BTN_PRIMARY, ADMIN_BTN_SECONDARY, ADMIN_INPUT, ADMIN_LABEL, ADMIN_PANEL } from "./adminUi";
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
      setSummary(await getPricechartingCatalog());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load catalog");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSyncGuide(key: string) {
    setSyncingKey(key);
    setError(null);
    setGuideResult(null);
    try {
      setGuideResult(await syncPricechartingGuide(key));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
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

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <MarketplaceAdminPageHeader
        title="PriceCharting catalog"
        subtitle="가이드 버튼을 누르면 서버가 CSV를 받아 최신 가격으로 갱신합니다. 바뀐 가격은 날짜별로 남습니다."
      />

      <section className={`${ADMIN_PANEL} space-y-4 p-4 sm:p-5`}>
        <h2 className="text-sm font-semibold text-zinc-900">가이드 갱신</h2>
        <p className="text-sm text-zinc-600">
          버튼을 누르면 그 가이드만 서버에서 받아 저장합니다. 주소는 화면에 나오지 않습니다.
          상품 행은 최신 가격으로 갱신되고, 가격이 바뀐 상품은 오늘(한국시간) 이력으로 남습니다.
          스포츠 세트는 아래 파일 업로드입니다.
        </p>
        <ul className="space-y-3">
          {(summary?.guides ?? []).map((guide) => (
            <li key={guide.key} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">{guide.label}</p>
                <p className="text-sm text-zinc-600">
                  {guide.lastRunAt
                    ? `${guide.lastRowCount?.toLocaleString() ?? 0}행 · ${new Date(guide.lastRunAt).toLocaleString()}`
                    : "아직 실행 전"}
                </p>
              </div>
              <button
                type="button"
                className={ADMIN_BTN_PRIMARY}
                disabled={busy || syncingKey !== null}
                onClick={() => void onSyncGuide(guide.key)}
              >
                {syncingKey === guide.key ? "받는 중…" : "갱신"}
              </button>
            </li>
          ))}
        </ul>
        {guideResult ? (
          <p className="text-sm text-emerald-700">
            {guideResult.label}: {guideResult.rowCount.toLocaleString()}행 갱신 · 가격 이력{" "}
            {guideResult.historyCount.toLocaleString()}건. 카탈로그 합계{" "}
            {guideResult.totalProducts.toLocaleString()}.
          </p>
        ) : null}
        {guideResult?.archiveError ? (
          <p className="text-sm text-amber-700">Import succeeded, but raw CSV archival failed.</p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>

      <section className={`${ADMIN_PANEL} space-y-4 p-4 sm:p-5`}>
        <p className="text-sm text-zinc-600">
          스포츠 세트 CSV를 올리면 됩니다. 파일 이름은 쓰지 않습니다. 파일 안의 세트명으로
          sports/세트명/세트명-날짜.csv 에 저장하고, 같은 날 같은 세트는 그 파일만 덮어씁니다.
          상품은 id 기준으로 갱신됩니다. 가격은 센트 정수입니다 (PSA 10 = manual-only).
        </p>
        <label className="block text-sm font-medium text-zinc-800">
          CSV / TSV
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            className="mt-2 block w-full text-sm"
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
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {result ? (
          <p className="text-sm text-emerald-700">
            {result.filename}: {result.rowCount.toLocaleString()}행 upsert
            {result.skipped ? ` · ${result.skipped}행 건너뜀` : ""} · 가격 이력{" "}
            {result.historyCount.toLocaleString()}건. 카탈로그 합계{" "}
            {result.totalProducts.toLocaleString()}.
          </p>
        ) : null}
        {result?.archiveError ? (
          <p className="text-sm text-amber-700">Import succeeded, but raw CSV archival failed.</p>
        ) : null}
      </section>

      <section className={`${ADMIN_PANEL} p-4 sm:p-5`}>
        <h2 className="text-sm font-semibold text-zinc-900">
          저장된 상품 {summary ? summary.totalProducts.toLocaleString() : "…"}
        </h2>
        <ul className="mt-3 space-y-1 text-sm text-zinc-700">
          {(summary?.byGenre ?? []).map((row) => (
            <li key={row.genre} className="flex justify-between gap-4">
              <span>{row.genre}</span>
              <span className="font-mono">{row.count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${ADMIN_PANEL} p-4 sm:p-5`}>
        <h2 className="text-sm font-semibold text-zinc-900">최근 업로드</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-700">
          {(summary?.recentRuns ?? []).map((run) => (
            <li key={run.id}>
              <span className="font-medium text-zinc-900">{run.filename}</span>
              {" · "}
              {run.rowCount.toLocaleString()}행 · {new Date(run.createdAt).toLocaleString()}
              {run.errorMessage ? (
                <span className="text-amber-700"> · {run.errorMessage}</span>
              ) : null}
            </li>
          ))}
          {summary && summary.recentRuns.length === 0 ? (
            <li className="text-zinc-500">아직 없습니다.</li>
          ) : null}
        </ul>
      </section>

      <section className={`${ADMIN_PANEL} space-y-4 p-4 sm:p-5`}>
        <h2 className="text-sm font-semibold text-zinc-900">박스 대표 이미지</h2>
        <p className="text-sm text-zinc-600">
          S3에 올린 주소는 pricecharting_products.cover_image_url 에 저장됩니다. CSV를
          다시 올려도 이 칸은 유지됩니다. 컬렉션 상세의 대표 이미지이고, 파트너는 자기
          사진 없이 이 이미지로 민트할 수 있습니다. 민트는 그때의 사진을 토큰에 복사하므로
          나중에 대표 이미지를 바꿔도 이미 민트된 박스는 바뀌지 않습니다.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className={`${ADMIN_LABEL} min-w-0 flex-1`}>
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
        {coverSearchError ? <p className="text-sm text-red-600">{coverSearchError}</p> : null}
        {coverHits ? (
          coverHits.length === 0 ? (
            <p className="text-sm text-zinc-500">맞는 상품이 없습니다.</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-zinc-200 p-1">
              {coverHits.map((hit) => {
                const selected = coverPick?.id === hit.id;
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-50 ${
                        selected ? "bg-zinc-100" : ""
                      }`}
                      onClick={() => {
                        setCoverPick(hit);
                        setCoverUrl(hit.coverImageUrl ?? null);
                        setCoverError(null);
                        setCoverFile(null);
                      }}
                    >
                      <span className="font-medium text-zinc-900">{hit.productName}</span>
                      <span className="mt-0.5 block text-xs text-zinc-600">
                        {hit.consoleName}
                        {hit.coverImageUrl ? " · 대표 이미지 있음" : ""}
                        {" · "}
                        <span className="font-mono">{hit.id}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
        {coverPick ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-800">
              <span className="font-medium">{coverPick.productName}</span>
              <span className="text-zinc-600"> · {coverPick.consoleName}</span>
            </p>
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt=""
                className="h-28 w-24 rounded-md border border-zinc-200 object-cover"
              />
            ) : (
              <p className="text-sm text-zinc-500">아직 대표 이미지가 없습니다.</p>
            )}
            <label className="block text-sm font-medium text-zinc-800">
              JPEG, PNG, WebP
              <input
                key={`${coverPick.id}:${coverUrl ?? ""}`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mt-2 block w-full text-sm"
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
            {coverError ? <p className="text-sm text-red-600">{coverError}</p> : null}
          </div>
        ) : null}
      </section>

      <section className={`${ADMIN_PANEL} space-y-4 p-4 sm:p-5`}>
        <h2 className="text-sm font-semibold text-zinc-900">과거 가격 입력</h2>
        <p className="text-sm text-zinc-600">
          카드나 박스 이름으로 찾은 뒤, 그 날짜의 가격만 넣습니다. 달러로 입력하고, 비운 칸은
          그 날짜에 저장돼 있던 값을 그대로 둡니다. 지금 카탈로그에 보이는 최신 가격은 바뀌지
          않습니다. PSA 10은 manual-only 칸입니다.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className={`${ADMIN_LABEL} min-w-0 flex-1`}>
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
        {historySearchError ? <p className="text-sm text-red-600">{historySearchError}</p> : null}
        {historyHits ? (
          historyHits.length === 0 ? (
            <p className="text-sm text-zinc-500">맞는 상품이 없습니다.</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-zinc-200 p-1">
              {historyHits.map((hit) => {
                const selected = historyPick?.id === hit.id;
                const loose =
                  hit.loosePriceCents == null
                    ? null
                    : `$${(hit.loosePriceCents / 100).toFixed(2)}`;
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-50 ${
                        selected ? "bg-zinc-100" : ""
                      }`}
                      onClick={() => pickHistoryProduct(hit)}
                    >
                      <span className="font-medium text-zinc-900">{hit.productName}</span>
                      <span className="mt-0.5 block text-xs text-zinc-600">
                        {hit.consoleName}
                        {hit.genre ? ` · ${hit.genre}` : ""}
                        {loose ? ` · Loose ${loose}` : ""}
                        {" · "}
                        <span className="font-mono">{hit.id}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
        {historyHits && historyHits.length === 20 ? (
          <p className="text-xs text-zinc-500">
            20개까지만 보여 줍니다. 세트 이름을 더 적으면 목록이 줄어듭니다.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
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
              <span className="mt-1 block text-xs font-normal text-zinc-600">
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <button
          type="button"
          className={ADMIN_BTN_PRIMARY}
          disabled={historyBusy || !historyProductId.trim() || !historyDate}
          onClick={() => void onSaveHistory()}
        >
          {historyBusy ? "저장 중…" : "이 날짜 가격 저장"}
        </button>
        {historyError ? <p className="text-sm text-red-600">{historyError}</p> : null}
        {historyResult ? (
          <p className="text-sm text-emerald-700">
            {historyResult.productName} ({historyResult.productId}) · {historyResult.observedOn} ·{" "}
            {Object.keys(historyResult.savedCents).length}개 가격 저장. 최신 카탈로그 가격은
            그대로입니다.
          </p>
        ) : null}
      </section>
    </article>
  );
}
