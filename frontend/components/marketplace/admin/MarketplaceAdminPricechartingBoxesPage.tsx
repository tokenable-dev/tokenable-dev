"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listPricechartingBoxes,
  uploadPricechartingCover,
  uploadPricechartingHistoryCsv,
  uploadPricechartingTradesCsv,
  type PricechartingHistoryBulkResult,
  type PricechartingProductHit,
  type PricechartingTradesBulkResult,
} from "@/lib/core/api/marketplace-admin-pricecharting";
import {
  downloadPricechartingSampleHistoryCsv,
  normalizeSampleHistoryProductId,
} from "@/lib/marketplace/admin/pricechartingSampleHistoryCsv";
import { downloadTradesCsvFromPaste } from "@/lib/marketplace/admin/pricechartingPasteTradesCsv";
import {
  downloadPricechartingSampleTradesCsv,
  SAMPLE_TRADES_DEFAULT_PRODUCT_ID,
} from "@/lib/marketplace/admin/pricechartingSampleTradesCsv";

const TRADES_PASTE_EXAMPLE = `2025-11-02 168.50
2025-11-04, 172
11/15/2025	$261.00
2026-01-08 255.00 eBay Buy It Now`;
import { AdminSectionTitle } from "./AdminAnalyticsWidgets";
import {
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_PANEL,
  ADMIN_TEXT_EMPTY,
  ADMIN_TEXT_ERROR,
  ADMIN_TEXT_META,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
  ADMIN_TOOLBAR,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

const PAGE_SIZE = 40;

const HISTORY_CSV_EXAMPLE = `product_id,observed_on,loose_price
7292337,2024-01-15,245.00
7292337,2024-01-16,251.50`;

const TRADES_CSV_EXAMPLE = `product_id,traded_on,price,source,sale_type
5490667,2025-11-02,168.50,eBay,Buy It Now
5490667,2025-11-04,172.00,eBay,Buy It Now`;

export function MarketplaceAdminPricechartingBoxesPage() {
  const [items, setItems] = useState<PricechartingProductHit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [missingCoverOnly, setMissingCoverOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [historyFile, setHistoryFile] = useState<File | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyResult, setHistoryResult] =
    useState<PricechartingHistoryBulkResult | null>(null);
  const [syncCurrent, setSyncCurrent] = useState(false);
  const [sampleProductId, setSampleProductId] = useState("");
  const [sampleCsvError, setSampleCsvError] = useState<string | null>(null);
  const sampleProductIdOk = normalizeSampleHistoryProductId(sampleProductId) != null;
  const [tradesFile, setTradesFile] = useState<File | null>(null);
  const [tradesBusy, setTradesBusy] = useState(false);
  const [tradesError, setTradesError] = useState<string | null>(null);
  const [tradesResult, setTradesResult] =
    useState<PricechartingTradesBulkResult | null>(null);
  const [tradesSampleProductId, setTradesSampleProductId] = useState(
    SAMPLE_TRADES_DEFAULT_PRODUCT_ID,
  );
  const [tradesSampleError, setTradesSampleError] = useState<string | null>(null);
  const tradesSampleOk =
    normalizeSampleHistoryProductId(tradesSampleProductId) != null;
  const [tradesPasteProductId, setTradesPasteProductId] = useState(
    SAMPLE_TRADES_DEFAULT_PRODUCT_ID,
  );
  const [tradesPasteText, setTradesPasteText] = useState("");
  const [tradesPasteError, setTradesPasteError] = useState<string | null>(null);
  const [tradesPasteInfo, setTradesPasteInfo] = useState<string | null>(null);
  const tradesPasteOk =
    normalizeSampleHistoryProductId(tradesPasteProductId) != null;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pack = await listPricechartingBoxes({
        page,
        pageSize: PAGE_SIZE,
        q,
        missingCoverOnly,
      });
      setItems(pack.items);
      setTotal(pack.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load boxes");
    } finally {
      setLoading(false);
    }
  }, [page, q, missingCoverOnly]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function onUploadCover(product: PricechartingProductHit, file: File) {
    setUploadingId(product.id);
    setError(null);
    try {
      const saved = await uploadPricechartingCover(product.id, file);
      setItems((prev) =>
        prev.map((row) =>
          row.id === product.id
            ? { ...row, coverImageUrl: saved.coverImageUrl }
            : row,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cover upload failed");
    } finally {
      setUploadingId(null);
    }
  }

  async function onUploadHistory() {
    if (!historyFile || historyBusy) return;
    setHistoryBusy(true);
    setHistoryError(null);
    setHistoryResult(null);
    try {
      setHistoryResult(
        await uploadPricechartingHistoryCsv(historyFile, { syncCurrent }),
      );
      setHistoryFile(null);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "History CSV upload failed",
      );
    } finally {
      setHistoryBusy(false);
    }
  }

  async function onUploadTrades() {
    if (!tradesFile || tradesBusy) return;
    setTradesBusy(true);
    setTradesError(null);
    setTradesResult(null);
    try {
      setTradesResult(await uploadPricechartingTradesCsv(tradesFile));
      setTradesFile(null);
    } catch (err) {
      setTradesError(
        err instanceof Error ? err.message : "Trades CSV upload failed",
      );
    } finally {
      setTradesBusy(false);
    }
  }

  function applyFilter() {
    setPage(1);
    setQ(qDraft.trim());
  }

  return (
    <article className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6">
      <MarketplaceAdminPageHeader
        title="Sealed boxes"
        subtitle="카탈로그 sealed box 전체 · 대표 이미지 · 과거 가격 · 외부 trades CSV"
      />

      <div className={ADMIN_TOOLBAR}>
        <label className={`${ADMIN_LABEL} mb-0 min-w-0 flex-1`}>
          검색
          <input
            className={`${ADMIN_INPUT} mt-1.5`}
            placeholder="비우면 전체 · 예: 151 booster"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilter();
            }}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:pb-0.5">
          <button
            type="button"
            className={ADMIN_BTN_SECONDARY}
            disabled={loading}
            onClick={applyFilter}
          >
            적용
          </button>
          {q ? (
            <button
              type="button"
              className={ADMIN_BTN_SECONDARY}
              disabled={loading}
              onClick={() => {
                setQDraft("");
                setQ("");
                setPage(1);
              }}
            >
              전체
            </button>
          ) : null}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              className="rounded border-zinc-300"
              checked={missingCoverOnly}
              onChange={(e) => {
                setPage(1);
                setMissingCoverOnly(e.target.checked);
              }}
            />
            커버 없음만
          </label>
        </div>
      </div>

      <section className={`${ADMIN_PANEL} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 sm:px-5">
          <div>
            <p className="text-sm font-semibold text-zinc-900">박스 목록</p>
            <p className={`mt-0.5 text-xs ${ADMIN_TEXT_META}`}>
              총 {total.toLocaleString()}개
              {q ? ` · “${q}”` : ""}
              {missingCoverOnly ? " · 커버 없음" : ""}
              {loading ? " · 불러오는 중…" : ""}
            </p>
          </div>
          <p className={`text-xs font-medium ${ADMIN_TEXT_SECONDARY}`}>
            {page} / {pageCount}
          </p>
        </div>

        {error ? (
          <p className={`border-b border-zinc-100 px-4 py-3 ${ADMIN_TEXT_ERROR} sm:px-5`}>
            {error}
          </p>
        ) : null}

        <ul className="divide-y divide-zinc-100">
          {items.map((box) => {
            const uploading = uploadingId === box.id;
            return (
              <li
                key={box.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
                    {box.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={box.coverImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className={`flex h-full w-full items-center justify-center border border-dashed border-zinc-300 text-[10px] ${ADMIN_TEXT_EMPTY}`}
                      >
                        No cover
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {box.productName}
                    </p>
                    <p className={`mt-0.5 truncate text-xs ${ADMIN_TEXT_MUTED}`}>
                      {box.consoleName}
                      {box.loosePriceCents != null
                        ? ` · $${(box.loosePriceCents / 100).toFixed(2)}`
                        : ""}
                    </p>
                    <p className={`mt-0.5 font-mono text-[11px] ${ADMIN_TEXT_META}`}>
                      {box.id}
                    </p>
                  </div>
                </div>
                <label
                  className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 ${
                    uploading ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  {uploading ? "올리는 중…" : box.coverImageUrl ? "커버 교체" : "커버 올리기"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void onUploadCover(box, file);
                    }}
                  />
                </label>
              </li>
            );
          })}
          {!loading && items.length === 0 ? (
            <li className={`px-4 py-10 text-center text-sm ${ADMIN_TEXT_EMPTY} sm:px-5`}>
              맞는 박스가 없습니다.
            </li>
          ) : null}
        </ul>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-4 py-3 sm:px-5">
          <button
            type="button"
            className={ADMIN_BTN_SECONDARY}
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            이전
          </button>
          <span className={`text-xs ${ADMIN_TEXT_META}`}>
            {(page - 1) * PAGE_SIZE + (items.length ? 1 : 0)}–
            {(page - 1) * PAGE_SIZE + items.length} / {total.toLocaleString()}
          </span>
          <button
            type="button"
            className={ADMIN_BTN_SECONDARY}
            disabled={loading || page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </button>
        </div>
      </section>

      <section className={`${ADMIN_PANEL} p-4 sm:p-5`}>
        <AdminSectionTitle
          title="과거 가격 CSV"
          subtitle="컬렉션 없이도 pricecharting_price_history에 날짜별 가격을 넣습니다. 기본은 카탈로그 최신 Loose를 바꾸지 않습니다."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/60 p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              포맷
            </p>
            <pre className="overflow-x-auto rounded-md border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-800">
              {HISTORY_CSV_EXAMPLE}
            </pre>
            <p className={`text-xs ${ADMIN_TEXT_META}`}>
              선택 열: cib_price, new_price, graded_price, manual_only_price(PSA 10) 등
              (달러). 최대 5MB / 5,000행.
            </p>
          </div>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/60 p-3 sm:p-4">
            <div>
              <p className="text-sm font-medium text-zinc-900">샘플 CSV</p>
              <p className={`mt-0.5 text-xs ${ADMIN_TEXT_META}`}>
                2023-09-01~2026-10-22 Ungraded 근사(~1,100행). DB에 넣지 않으니 받은 뒤
                아래에서 직접 업로드하세요.
              </p>
            </div>
            <label className={`${ADMIN_LABEL} mb-0 block`}>
              product_id
              <input
                className={`${ADMIN_INPUT} mt-1.5 font-mono`}
                value={sampleProductId}
                onChange={(e) => {
                  setSampleProductId(e.target.value);
                  setSampleCsvError(null);
                }}
                placeholder="예: 7292337"
                inputMode="numeric"
              />
            </label>
            <button
              type="button"
              className={ADMIN_BTN_SECONDARY}
              disabled={!sampleProductIdOk}
              onClick={() => {
                try {
                  setSampleCsvError(null);
                  downloadPricechartingSampleHistoryCsv(sampleProductId);
                } catch (err) {
                  setSampleCsvError(
                    err instanceof Error
                      ? err.message
                      : "product_id must be numeric",
                  );
                }
              }}
            >
              샘플 다운로드
            </button>
            {sampleCsvError ? (
              <p className={ADMIN_TEXT_ERROR}>{sampleCsvError}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-3 rounded-md border border-zinc-200 p-3 sm:p-4">
          <p className="text-sm font-medium text-zinc-900">업로드</p>
          <label className="flex cursor-pointer flex-col gap-1.5 rounded-md border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-3 transition-colors hover:border-zinc-400 hover:bg-zinc-50">
            <span className={`text-xs font-medium ${ADMIN_TEXT_SECONDARY}`}>CSV 선택</span>
            <span
              className={`truncate text-sm ${historyFile ? "text-zinc-900" : ADMIN_TEXT_EMPTY}`}
            >
              {historyFile ? historyFile.name : "파일을 선택하세요"}
            </span>
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
              className="sr-only"
              onChange={(e) => setHistoryFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              className="rounded border-zinc-300"
              checked={syncCurrent}
              onChange={(e) => setSyncCurrent(e.target.checked)}
            />
            Loose가 있으면 카탈로그 현재 가격도 갱신 (컬렉션 spot 포함)
          </label>
          <button
            type="button"
            className={ADMIN_BTN_PRIMARY}
            disabled={!historyFile || historyBusy}
            onClick={() => void onUploadHistory()}
          >
            {historyBusy ? "적재 중…" : "CSV 업로드"}
          </button>
          {historyError ? <p className={ADMIN_TEXT_ERROR}>{historyError}</p> : null}
          {historyResult ? (
            <div className="space-y-2 text-sm">
              <p className="text-emerald-700">
                {historyResult.filename}: {historyResult.ok.toLocaleString()}/
                {historyResult.rowCount.toLocaleString()}행 성공
                {historyResult.failed.length
                  ? ` · 실패 ${historyResult.failed.length}`
                  : ""}
              </p>
              {historyResult.failed.length > 0 ? (
                <ul className="max-h-40 overflow-y-auto rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  {historyResult.failed.slice(0, 40).map((row) => (
                    <li key={`${row.line}-${row.productId}`}>
                      line {row.line} · {row.productId || "?"} · {row.error}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className={`${ADMIN_PANEL} p-4 sm:p-5`}>
        <AdminSectionTitle
          title="Trades CSV (외부 comps)"
          subtitle="eBay 등 sold listing을 pricecharting_trade_history에 넣습니다. 해당 product_id 박스가 붙은 컬렉션 Trades 테이프에 표시됩니다. 같은 product_id는 업로드 시 전부 교체됩니다."
        />

        <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/60 p-3 sm:p-4">
          <div>
            <p className="text-sm font-medium text-zinc-900">
              붙여넣기 → CSV 다운로드
            </p>
            <p className={`mt-0.5 text-xs ${ADMIN_TEXT_META}`}>
              한 줄에 거래 하나. 날짜 + 가격만 있으면 됩니다. source / sale_type을
              빼면 eBay · Buy It Now로 채웁니다. 받은 CSV를 아래 업로드에 넣으세요.
            </p>
          </div>
          <label className={`${ADMIN_LABEL} mb-0 block max-w-xs`}>
            product_id
            <input
              className={`${ADMIN_INPUT} mt-1.5 font-mono`}
              value={tradesPasteProductId}
              onChange={(e) => {
                setTradesPasteProductId(e.target.value);
                setTradesPasteError(null);
                setTradesPasteInfo(null);
              }}
              placeholder="예: 5490667"
              inputMode="numeric"
            />
          </label>
          <label className={`${ADMIN_LABEL} mb-0 block`}>
            trade 내역 (한 줄 = 한 건)
            <textarea
              className={`${ADMIN_INPUT} mt-1.5 min-h-[10rem] font-mono text-sm`}
              value={tradesPasteText}
              onChange={(e) => {
                setTradesPasteText(e.target.value);
                setTradesPasteError(null);
                setTradesPasteInfo(null);
              }}
              placeholder={TRADES_PASTE_EXAMPLE}
              spellCheck={false}
            />
          </label>
          <pre className="overflow-x-auto rounded-md border border-zinc-200 bg-white p-3 text-[11px] leading-relaxed text-zinc-700">
            {TRADES_PASTE_EXAMPLE}
          </pre>
          <p className={`text-xs ${ADMIN_TEXT_META}`}>
            구분: 공백 · 탭 · 콤마 · |. 날짜:{" "}
            <code className="font-mono text-[11px]">YYYY-MM-DD</code> 또는{" "}
            <code className="font-mono text-[11px]">M/D/YYYY</code>. 가격:{" "}
            <code className="font-mono text-[11px]">168.50</code> /{" "}
            <code className="font-mono text-[11px]">$1,250.50</code>.
          </p>
          <button
            type="button"
            className={ADMIN_BTN_PRIMARY}
            disabled={!tradesPasteOk || !tradesPasteText.trim()}
            onClick={() => {
              try {
                setTradesPasteError(null);
                const result = downloadTradesCsvFromPaste(
                  tradesPasteProductId,
                  tradesPasteText,
                );
                setTradesPasteInfo(
                  result.skipped.length
                    ? `${result.rowCount}행 CSV 다운로드 · 건너뜀 ${result.skipped.length}`
                    : `${result.rowCount}행 CSV 다운로드`,
                );
              } catch (err) {
                setTradesPasteInfo(null);
                setTradesPasteError(
                  err instanceof Error ? err.message : "Could not build CSV",
                );
              }
            }}
          >
            CSV로 정제해 다운로드
          </button>
          {tradesPasteError ? (
            <p className={ADMIN_TEXT_ERROR}>{tradesPasteError}</p>
          ) : null}
          {tradesPasteInfo ? (
            <p className="text-sm text-emerald-700">{tradesPasteInfo}</p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/60 p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              업로드 CSV 포맷
            </p>
            <pre className="overflow-x-auto rounded-md border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-800">
              {TRADES_CSV_EXAMPLE}
            </pre>
            <p className={`text-xs ${ADMIN_TEXT_META}`}>
              필수: product_id, traded_on, price(달러). 선택: source(기본 eBay),
              sale_type(기본 Buy It Now), sale_url. 최대 5MB / 5,000행.
            </p>
          </div>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/60 p-3 sm:p-4">
            <div>
              <p className="text-sm font-medium text-zinc-900">샘플 CSV (~1년)</p>
              <p className={`mt-0.5 text-xs ${ADMIN_TEXT_META}`}>
                오늘 기준 약 1년 eBay Buy It Now. 가격은 히스토리 곡선 근처 샘플입니다.
                DB에 넣지 않으니 받은 뒤 아래에서 업로드하세요.
              </p>
            </div>
            <label className={`${ADMIN_LABEL} mb-0 block`}>
              product_id
              <input
                className={`${ADMIN_INPUT} mt-1.5 font-mono`}
                value={tradesSampleProductId}
                onChange={(e) => {
                  setTradesSampleProductId(e.target.value);
                  setTradesSampleError(null);
                }}
                placeholder="예: 5490667"
                inputMode="numeric"
              />
            </label>
            <button
              type="button"
              className={ADMIN_BTN_SECONDARY}
              disabled={!tradesSampleOk}
              onClick={() => {
                try {
                  setTradesSampleError(null);
                  downloadPricechartingSampleTradesCsv(tradesSampleProductId);
                } catch (err) {
                  setTradesSampleError(
                    err instanceof Error
                      ? err.message
                      : "product_id must be numeric",
                  );
                }
              }}
            >
              샘플 다운로드
            </button>
            {tradesSampleError ? (
              <p className={ADMIN_TEXT_ERROR}>{tradesSampleError}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-3 rounded-md border border-zinc-200 p-3 sm:p-4">
          <p className="text-sm font-medium text-zinc-900">업로드</p>
          <label className="flex cursor-pointer flex-col gap-1.5 rounded-md border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-3 transition-colors hover:border-zinc-400 hover:bg-zinc-50">
            <span className={`text-xs font-medium ${ADMIN_TEXT_SECONDARY}`}>
              CSV 선택
            </span>
            <span
              className={`truncate text-sm ${tradesFile ? "text-zinc-900" : ADMIN_TEXT_EMPTY}`}
            >
              {tradesFile ? tradesFile.name : "파일을 선택하세요"}
            </span>
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
              className="sr-only"
              onChange={(e) => setTradesFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            className={ADMIN_BTN_PRIMARY}
            disabled={!tradesFile || tradesBusy}
            onClick={() => void onUploadTrades()}
          >
            {tradesBusy ? "적재 중…" : "Trades CSV 업로드"}
          </button>
          {tradesError ? <p className={ADMIN_TEXT_ERROR}>{tradesError}</p> : null}
          {tradesResult ? (
            <div className="space-y-2 text-sm">
              <p className="text-emerald-700">
                {tradesResult.filename}: {tradesResult.ok.toLocaleString()}/
                {tradesResult.rowCount.toLocaleString()}행 성공
                {tradesResult.productIds.length
                  ? ` · products ${tradesResult.productIds.join(", ")}`
                  : ""}
                {tradesResult.failed.length
                  ? ` · 실패 ${tradesResult.failed.length}`
                  : ""}
              </p>
              {tradesResult.failed.length > 0 ? (
                <ul className="max-h-40 overflow-y-auto rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  {tradesResult.failed.slice(0, 40).map((row) => (
                    <li key={`${row.line}-${row.productId}`}>
                      line {row.line} · {row.productId || "?"} · {row.error}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </article>
  );
}
