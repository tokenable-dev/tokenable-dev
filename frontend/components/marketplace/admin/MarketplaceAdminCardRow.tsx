"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { useResolvedMediaUrl } from "@/hooks/media";
import type { AdminListedRwaCardRow, CollectionListMarketSnapshot } from "@/lib/core";
import { representativeGradeUsd } from "@/lib/market";
import { AdminMarketPriceStrip } from "./AdminMarketPriceStrip";

export function MarketplaceAdminCardRow({
  row,
  adminWallet,
  snapshot,
  busy,
  onSave,
  onPreviewMetadata,
  onClearImageOverride,
}: {
  row: AdminListedRwaCardRow;
  adminWallet: Address;
  snapshot?: CollectionListMarketSnapshot;
  busy: boolean;
  onSave: (patch: {
    displayImageUrl?: string | null;
    displayName?: string | null;
    collectionKey?: string | null;
  }) => Promise<void>;
  onPreviewMetadata: () => Promise<string | null>;
  onClearImageOverride: () => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(row.displayName ?? "");
  const [collectionKey, setCollectionKey] = useState(row.collectionKey ?? "");
  const [imageUrlInput, setImageUrlInput] = useState(row.displayImageUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<"save" | "preview" | "clear" | null>(
    null,
  );

  useEffect(() => {
    setDisplayName(row.displayName ?? "");
    setCollectionKey(row.collectionKey ?? "");
    setImageUrlInput(row.displayImageUrl ?? "");
    setPreviewUrl(null);
  }, [row]);

  const displayPreview =
    previewUrl ?? (imageUrlInput.trim() || row.resolvedImageUrl);
  const { url: resolvedPreview, isLoading: previewLoading } =
    useResolvedMediaUrl(displayPreview);

  async function handleSave() {
    setRowError(null);
    setRowBusy("save");
    try {
      await onSave({
        displayName: displayName.trim() || null,
        collectionKey: collectionKey.trim().toLowerCase() || null,
        displayImageUrl: imageUrlInput.trim() || null,
      });
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setRowBusy(null);
    }
  }

  async function handlePreviewMetadata() {
    setRowError(null);
    setRowBusy("preview");
    try {
      const url = await onPreviewMetadata();
      if (!url) {
        setRowError("No image resolved from metadata");
        return;
      }
      setPreviewUrl(url);
      setImageUrlInput(url);
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setRowBusy(null);
    }
  }

  async function handleClearOverride() {
    setRowError(null);
    setRowBusy("clear");
    try {
      await onClearImageOverride();
      setImageUrlInput("");
      setPreviewUrl(null);
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setRowBusy(null);
    }
  }

  const disabled = busy || rowBusy != null;

  const refUsd = representativeGradeUsd(snapshot?.gradePrices, 10, "10");
  const floorUsd = snapshot?.marketStats?.floor ?? null;

  return (
    <article className="rounded-xl border border-zinc-800/90 bg-zinc-950/60 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-900/80 sm:h-32 sm:w-28">
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
            <span className="text-[10px] text-zinc-600">No image</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">
                <Link
                  href={`/marketplace/${row.tokenId}`}
                  className="text-mint hover:underline"
                >
                  Token #{row.tokenId}
                </Link>
              </h3>
              <p className="font-mono text-[10px] text-zinc-500">
                cert {row.certNumber ?? "—"}
              </p>
              <AdminMarketPriceStrip
                askUsd={row.priceUsdc}
                refUsd={refUsd}
                floorUsd={floorUsd}
                compact
              />
            </div>
            <span className="font-mono text-[10px] text-amber-200/50">
              {adminWallet.slice(0, 6)}…{adminWallet.slice(-4)}
            </span>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Display name
            </span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-2 text-[11px] text-white outline-none focus:border-amber-500/50"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Collection key
            </span>
            <input
              value={collectionKey}
              onChange={(e) => setCollectionKey(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-2 font-mono text-[10px] text-white outline-none focus:border-amber-500/50"
              spellCheck={false}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Display image URL (admin override)
            </span>
            <input
              type="url"
              value={imageUrlInput}
              onChange={(e) => {
                setImageUrlInput(e.target.value);
                setPreviewUrl(null);
              }}
              placeholder="https://… or ipfs://…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-2 font-mono text-[10px] text-white outline-none focus:border-amber-500/50"
            />
            {row.catalogImageUrl ? (
              <p className="mt-1 truncate text-[10px] text-zinc-600">
                Metadata default: {row.catalogImageUrl}
              </p>
            ) : null}
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => void handleSave()}
              className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-[11px] font-bold text-[#0a0a0a] hover:bg-amber-400 disabled:opacity-50"
            >
              {rowBusy === "save" ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void handlePreviewMetadata()}
              className="rounded-lg border border-zinc-600 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800/80 disabled:opacity-50"
            >
              {rowBusy === "preview" ? "Fetching…" : "From metadata"}
            </button>
            <button
              type="button"
              disabled={disabled || !row.displayImageUrl}
              onClick={() => void handleClearOverride()}
              className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-400 hover:bg-zinc-800/80 disabled:opacity-40"
            >
              {rowBusy === "clear" ? "Clearing…" : "Clear override"}
            </button>
            {row.collectionKey ? (
              <Link
                href={`/marketplace/collections/${encodeURIComponent(row.collectionKey)}`}
                className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-800/80"
              >
                Collection
              </Link>
            ) : null}
          </div>

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
