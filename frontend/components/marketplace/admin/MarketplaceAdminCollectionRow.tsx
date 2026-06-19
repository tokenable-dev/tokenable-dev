"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import { useResolvedMediaUrl } from "@/hooks/media";
import { useCollectionAdminCover } from "@/hooks/marketplace/collection-hero/useCollectionAdminCover";
import { parseGradeScoreNumber, representativeGradeUsd } from "@/lib/market";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import { AdminMarketPriceStrip } from "./AdminMarketPriceStrip";

export function MarketplaceAdminCollectionRow({
  row,
  snapshot,
  adminWallet,
  busy,
  onCoverSaved,
  onDeleted,
}: {
  row: MarketplaceCollectionSummary;
  snapshot: CollectionListMarketSnapshot | undefined;
  adminWallet: Address;
  busy: boolean;
  onCoverSaved: () => void;
  onDeleted: () => void;
}) {
  const currentCoverUrl = row.coverImageUrl ?? row.displayImageUrl ?? "";
  const [urlInput, setUrlInput] = useState(currentCoverUrl);
  const [tokenIdInput, setTokenIdInput] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const {
    busy: coverBusy,
    error: coverApiError,
    setError: setCoverApiError,
    saveCoverUrl,
    fetchCoverFromToken,
    deleteCollection,
  } = useCollectionAdminCover({
    collectionKey: row.collectionKey,
    adminWallet,
    onSaved: onCoverSaved,
    onDeleted,
  });

  useEffect(() => {
    setUrlInput(currentCoverUrl);
    setPreviewUrl(null);
    setDeleteConfirm("");
    setValidationError(null);
    setCoverApiError(null);
  }, [row.collectionKey, currentCoverUrl, setCoverApiError]);

  const rowError = validationError ?? coverApiError;

  const gradeScore = parseGradeScoreNumber(
    typeof row.components.gradeScore === "string" ? row.components.gradeScore : null,
  );
  const refUsd = representativeGradeUsd(
    snapshot?.gradePrices,
    gradeScore,
    typeof row.components.gradeScore === "string" ? row.components.gradeScore : null,
  );
  const floorUsd = snapshot?.marketStats?.floor ?? null;
  const lastTradeUsd = snapshot?.lastTokenableTradeUsdc ?? null;
  const changePct = snapshot?.marketChangePct;

  const displayPreview = (previewUrl ?? urlInput.trim()) || null;
  const { url: resolvedPreview, isLoading: previewLoading } =
    useResolvedMediaUrl(displayPreview);

  const deleteKeyMatches =
    deleteConfirm.trim().toLowerCase() === row.collectionKey.trim().toLowerCase();

  const disabled = busy || coverBusy != null;

  async function saveUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setValidationError("Enter a cover URL");
      return;
    }
    setValidationError(null);
    setCoverApiError(null);
    const ok = await saveCoverUrl(trimmed);
    if (ok) {
      setUrlInput(trimmed);
      setPreviewUrl(null);
    }
  }

  async function fetchFromToken(save: boolean) {
    const tid = tokenIdInput.trim();
    if (!tid) {
      setValidationError("Enter a token ID");
      return;
    }
    setValidationError(null);
    setCoverApiError(null);
    const coverUrl = await fetchCoverFromToken(tid, save);
    if (coverUrl) {
      setUrlInput(coverUrl);
      setPreviewUrl(save ? null : coverUrl);
    }
  }

  return (
    <article className="rounded-xl border border-zinc-800/90 bg-zinc-950/60 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-900/80 sm:h-28 sm:w-24">
          {displayPreview && resolvedPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedPreview}
              alt=""
              className="max-h-full max-w-full object-contain p-1"
            />
          ) : previewLoading ? (
            <span className="text-[10px] text-zinc-500">Loading…</span>
          ) : (
            <span className="text-[10px] text-zinc-600">No cover</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-white">
                <Link
                  href={`/marketplace/collections/${encodeURIComponent(row.collectionKey)}`}
                  className="text-mint hover:underline"
                >
                  {row.displayLabel || row.collectionKey}
                </Link>
              </h3>
              <p className="truncate font-mono text-[10px] text-zinc-500">
                {row.collectionKey}
              </p>
              <p className="mt-1 text-[10px] text-zinc-500">
                {row.activeListingCount} active listing
                {row.activeListingCount === 1 ? "" : "s"}
                {changePct != null && Number.isFinite(changePct)
                  ? ` · ${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}% ref`
                  : ""}
              </p>
            </div>
            {lastTradeUsd != null ? (
              <div className="text-right">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-600">
                  Last trade
                </span>
                <p className="text-[11px] font-semibold text-zinc-200">
                  {formatUsdCompact(lastTradeUsd)}
                </p>
              </div>
            ) : null}
          </div>

          <AdminMarketPriceStrip refUsd={refUsd} floorUsd={floorUsd} compact />

          <details className="rounded-lg border border-amber-500/35 bg-amber-500/[0.04] p-2.5">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
              Cover image
            </summary>
            <div className="mt-2 space-y-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Cover URL (https or ipfs)
                </span>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setPreviewUrl(null);
                  }}
                  placeholder="https://…"
                  className="w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-2 font-mono text-[10px] text-white outline-none focus:border-amber-500/50"
                />
              </label>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void saveUrl()}
                className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-[11px] font-bold text-[#0a0a0a] hover:bg-amber-400 disabled:opacity-50"
              >
                {coverBusy === "url" ? "Saving…" : "Save cover URL"}
              </button>

              <div className="border-t border-zinc-800/80 pt-2">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  From token metadata
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tokenIdInput}
                    onChange={(e) => setTokenIdInput(e.target.value)}
                    placeholder="Token ID"
                    className="w-24 rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-1.5 font-mono text-[10px] text-white outline-none focus:border-amber-500/50"
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void fetchFromToken(false)}
                    className="rounded-lg border border-zinc-600 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-200 hover:bg-zinc-800/80 disabled:opacity-50"
                  >
                    {coverBusy === "fetch" ? "Fetching…" : "Preview"}
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void fetchFromToken(true)}
                    className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-2.5 py-1.5 text-[10px] font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
                  >
                    {coverBusy === "apply" ? "Applying…" : "Fetch & save"}
                  </button>
                </div>
              </div>
            </div>
          </details>

          <details className="rounded-lg border border-red-900/40 bg-red-950/10 p-2.5">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-red-400/90">
              Delete collection
            </summary>
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
              Removes snapshots, orders, rwa_tokens rows, and the collection row.
              On-chain NFTs are not burned. Type the collection key to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={row.collectionKey.slice(0, 20) + "…"}
              className="mt-2 w-full min-w-0 rounded-lg border border-red-900/60 bg-zinc-950/80 px-2.5 py-2 font-mono text-[10px] text-white outline-none focus:border-red-500/60"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              disabled={disabled || !deleteKeyMatches}
              onClick={() => {
                if (
                  !window.confirm(
                    "Permanently delete this collection from the marketplace database?",
                  )
                ) {
                  return;
                }
                setValidationError(null);
                setCoverApiError(null);
                void deleteCollection(deleteConfirm.trim());
              }}
              className="mt-2 rounded-lg border border-red-600/70 bg-red-950/40 px-3 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-900/50 disabled:opacity-40"
            >
              {coverBusy === "delete" ? "Deleting…" : "Delete permanently"}
            </button>
          </details>

          {rowError ? (
            <p className="text-[11px] text-red-400" role="alert">
              {rowError}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
