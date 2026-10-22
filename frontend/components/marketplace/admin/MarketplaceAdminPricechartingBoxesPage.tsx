"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listPricechartingBoxes,
  uploadPricechartingCover,
  uploadPricechartingHistoryCsv,
  type PricechartingHistoryBulkResult,
  type PricechartingProductHit,
} from "@/lib/core/api/marketplace-admin-pricecharting";
import {
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_PANEL,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

const PAGE_SIZE = 40;

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

  return (
    <article className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <MarketplaceAdminPageHeader
        title="Sealed boxes"
        subtitle="DB에 있는 sealed box를 전부 리스팅합니다. 컬렉션이 없어도 대표 이미지를 올리고, 아래에서 과거 가격 CSV를 넣을 수 있습니다."
      />

      <section className={`${ADMIN_PANEL} space-y-4 p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className={`${ADMIN_LABEL} min-w-0 flex-1`}>
            목록 필터 (선택)
            <input
              className={`${ADMIN_INPUT} mt-1.5`}
              placeholder="비우면 전체 박스 · 예: 151 booster"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setQ(qDraft.trim());
                }
              }}
            />
          </label>
          <button
            type="button"
            className={ADMIN_BTN_SECONDARY}
            disabled={loading}
            onClick={() => {
              setPage(1);
              setQ(qDraft.trim());
            }}
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
              전체 보기
            </button>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={missingCoverOnly}
              onChange={(e) => {
                setPage(1);
                setMissingCoverOnly(e.target.checked);
              }}
            />
            대표 이미지 없는 것만
          </label>
        </div>
        <p className="text-sm text-zinc-600">
          총 {total.toLocaleString()}개 · {page}/{pageCount} 페이지
          {loading ? " · 불러오는 중…" : ""}
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
          {items.map((box) => (
            <li
              key={box.id}
              className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                {box.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={box.coverImageUrl}
                    alt=""
                    className="h-16 w-14 shrink-0 rounded border border-zinc-200 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded border border-dashed border-zinc-300 bg-zinc-50 text-[10px] text-zinc-500">
                    No cover
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {box.productName}
                  </p>
                  <p className="truncate text-xs text-zinc-600">
                    {box.consoleName}
                    {box.loosePriceCents != null
                      ? ` · Loose $${(box.loosePriceCents / 100).toFixed(2)}`
                      : ""}
                    {" · "}
                    <span className="font-mono">{box.id}</span>
                  </p>
                </div>
              </div>
              <label className="shrink-0 text-sm font-medium text-zinc-800">
                <span className="sr-only">Upload cover for {box.productName}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="block w-full max-w-[14rem] text-xs"
                  disabled={uploadingId === box.id}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void onUploadCover(box, file);
                  }}
                />
                {uploadingId === box.id ? (
                  <span className="mt-1 block text-xs text-zinc-500">
                    올리는 중…
                  </span>
                ) : null}
              </label>
            </li>
          ))}
          {!loading && items.length === 0 ? (
            <li className="p-4 text-sm text-zinc-500">맞는 박스가 없습니다.</li>
          ) : null}
        </ul>
        <div className="flex gap-2">
          <button
            type="button"
            className={ADMIN_BTN_SECONDARY}
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            이전
          </button>
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

      <section className={`${ADMIN_PANEL} space-y-4 p-4 sm:p-5`}>
        <h2 className="text-sm font-semibold text-zinc-900">
          과거 가격 CSV 일괄 적재
        </h2>
        <p className="text-sm text-zinc-600">
          컬렉션이 없어도 <code className="font-mono text-xs">pricecharting_price_history</code>에
          날짜별 가격을 넣습니다. 기본은 카탈로그 최신 Loose를 바꾸지 않습니다.
        </p>
        <pre className="overflow-x-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-800">{`product_id,observed_on,loose_price
7292337,2024-01-15,245.00
7292337,2024-01-16,251.50`}</pre>
        <p className="text-xs text-zinc-500">
          선택 열: cib_price, new_price, graded_price, manual_only_price(PSA 10) 등
          (달러). 최대 5MB / 5,000행.
        </p>
        <label className="block text-sm font-medium text-zinc-800">
          CSV
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            className="mt-2 block w-full text-sm"
            onChange={(e) => setHistoryFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
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
        {historyError ? (
          <p className="text-sm text-red-600">{historyError}</p>
        ) : null}
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
              <ul className="max-h-40 overflow-y-auto rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                {historyResult.failed.slice(0, 40).map((row) => (
                  <li key={`${row.line}-${row.productId}`}>
                    line {row.line} · {row.productId || "?"} · {row.error}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </article>
  );
}
