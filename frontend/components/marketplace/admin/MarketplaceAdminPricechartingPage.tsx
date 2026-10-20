"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPricechartingCatalog,
  syncPricechartingGuide,
  uploadPricechartingCsv,
  type PricechartingCatalogSummary,
  type PricechartingGuideSyncResult,
  type PricechartingImportResult,
} from "@/lib/core/api/marketplace-admin-pricecharting";
import { ADMIN_BTN_PRIMARY, ADMIN_PANEL } from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

export function MarketplaceAdminPricechartingPage() {
  const [summary, setSummary] = useState<PricechartingCatalogSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PricechartingImportResult | null>(null);
  const [guideResult, setGuideResult] = useState<PricechartingGuideSyncResult | null>(null);
  const [syncingKey, setSyncingKey] = useState<string | null>(null);

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
    </article>
  );
}
