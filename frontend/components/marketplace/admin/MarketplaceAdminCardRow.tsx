"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useResolvedMediaUrl } from "@/hooks/media";
import type { AdminListedRwaCardRow, CollectionListMarketSnapshot } from "@/lib/core";
import { representativeGradeUsd } from "@/lib/market";
import { AdminMarketPriceStrip } from "./AdminMarketPriceStrip";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_COVER_BOX_CARD,
  ADMIN_INPUT,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
} from "./adminUi";

export function MarketplaceAdminCardRow({
  row,
  snapshot,
  busy,
  onSave,
  onPreviewMetadata,
  onClearImageOverride,
}: {
  row: AdminListedRwaCardRow;
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
    <article className={ADMIN_ARTICLE}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className={ADMIN_COVER_BOX_CARD}>
          {displayPreview && resolvedPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedPreview}
              alt=""
              className="max-h-full max-w-full object-contain p-2"
            />
          ) : previewLoading ? (
            <span className="text-sm text-zinc-500">Loading…</span>
          ) : (
            <span className="text-sm text-zinc-600">No image</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-5">
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white sm:text-xl">
              <Link
                href={`/marketplace/${row.tokenId}`}
                className="text-mint hover:underline"
              >
                Token #{row.tokenId}
              </Link>
            </h3>
            <p className="font-mono text-sm text-zinc-500">
              Cert {row.certNumber ?? "—"}
            </p>
            <AdminMarketPriceStrip
              askUsd={row.priceUsdc}
              refUsd={refUsd}
              floorUsd={floorUsd}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={ADMIN_LABEL}>Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={ADMIN_INPUT}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className={ADMIN_LABEL}>Collection key</span>
              <input
                value={collectionKey}
                onChange={(e) => setCollectionKey(e.target.value)}
                className={ADMIN_INPUT_MONO}
                spellCheck={false}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className={ADMIN_LABEL}>Display image URL (admin override)</span>
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => {
                  setImageUrlInput(e.target.value);
                  setPreviewUrl(null);
                }}
                placeholder="https://… or ipfs://…"
                className={ADMIN_INPUT_MONO}
              />
              {row.catalogImageUrl ? (
                <p className="mt-2 truncate text-xs text-zinc-600 sm:text-sm">
                  Metadata default: {row.catalogImageUrl}
                </p>
              ) : null}
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={() => void handleSave()}
              className={ADMIN_BTN_PRIMARY}
            >
              {rowBusy === "save" ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void handlePreviewMetadata()}
              className={ADMIN_BTN_SECONDARY}
            >
              {rowBusy === "preview" ? "Fetching…" : "From metadata"}
            </button>
            <button
              type="button"
              disabled={disabled || !row.displayImageUrl}
              onClick={() => void handleClearOverride()}
              className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-400 hover:bg-zinc-800/80 disabled:opacity-40"
            >
              {rowBusy === "clear" ? "Clearing…" : "Clear override"}
            </button>
            {row.collectionKey ? (
              <Link
                href={`/marketplace/collections/${encodeURIComponent(row.collectionKey)}`}
                className={ADMIN_BTN_SECONDARY}
              >
                View collection
              </Link>
            ) : null}
          </div>

          {rowError ? (
            <p className="text-sm text-red-400" role="alert">
              {rowError}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
