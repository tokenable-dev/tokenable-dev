"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useResolvedMediaUrl } from "@/hooks/media";
import type { AdminRwaCardRow, CollectionListMarketSnapshot } from "@/lib/core";
import { representativeGradeUsd } from "@/lib/market";
import { AdminMarketPriceStrip } from "./AdminMarketPriceStrip";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_DANGER,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_COVER_BOX_CARD,
  ADMIN_INPUT,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
  ADMIN_LINK,
  ADMIN_TEXT_EMPTY,
  ADMIN_TEXT_META,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";

export function MarketplaceAdminCardRow({
  row,
  snapshot,
  busy,
  onSave,
  onPreviewMetadata,
  onClearImageOverride,
  onUploadSlab,
  onBurn,
  burningTokenId,
  onConfirmRelease,
  confirmingReleaseId,
}: {
  row: AdminRwaCardRow;
  snapshot?: CollectionListMarketSnapshot;
  busy: boolean;
  onSave: (patch: {
    displayImageUrl?: string | null;
    displayName?: string | null;
    collectionKey?: string | null;
  }) => Promise<void>;
  onPreviewMetadata: () => Promise<string | null>;
  onClearImageOverride: () => Promise<void>;
  onUploadSlab?: (face: "front" | "back", file: File) => Promise<void>;
  onBurn?: () => void;
  burningTokenId?: number | null;
  onConfirmRelease?: () => void;
  confirmingReleaseId?: string | null;
}) {
  const [displayName, setDisplayName] = useState(row.displayName ?? "");
  const [collectionKey, setCollectionKey] = useState(row.collectionKey ?? "");
  const [imageUrlInput, setImageUrlInput] = useState(row.displayImageUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<
    "save" | "preview" | "clear" | "upload-front" | "upload-back" | null
  >(null);

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
  const { url: resolvedBack } = useResolvedMediaUrl(
    row.displayImageBackUrl ?? null,
  );

  async function handleUploadFace(face: "front" | "back", file: File | undefined) {
    if (!file || !onUploadSlab) return;
    setRowError(null);
    setRowBusy(face === "back" ? "upload-back" : "upload-front");
    try {
      await onUploadSlab(face, file);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setRowBusy(null);
    }
  }

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
  const isBurned = Boolean(row.burnedAt);
  const isBurning = burningTokenId === row.tokenId;
  const canBurn = !isBurned && onBurn != null;
  const pendingReleaseId = row.pendingReleaseRedemptionId?.trim() || null;
  const isConfirmingRelease =
    pendingReleaseId != null && confirmingReleaseId === pendingReleaseId;

  const refUsd = representativeGradeUsd(snapshot?.gradePrices, 10, "10");
  const floorUsd = snapshot?.marketStats?.floor ?? null;

  const statusLabel = row.burnedAt
    ? "Burned"
    : row.hasActiveListing
      ? "Listed"
      : "Unlisted";
  const statusTone = row.burnedAt
    ? "bg-zinc-200 text-zinc-700 ring-zinc-300"
    : row.hasActiveListing
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : "bg-amber-50 text-amber-800 ring-amber-200";

  return (
    <article className={ADMIN_ARTICLE}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
          <div>
            <p className={`mb-1 text-xs font-medium ${ADMIN_TEXT_MUTED}`}>Front</p>
            <div className={ADMIN_COVER_BOX_CARD}>
              {displayPreview && resolvedPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolvedPreview}
                  alt=""
                  className="max-h-full max-w-full object-contain p-2"
                />
              ) : previewLoading ? (
                <span className={`text-sm ${ADMIN_TEXT_EMPTY}`}>Loading…</span>
              ) : (
                <span className={`text-sm ${ADMIN_TEXT_MUTED}`}>No front</span>
              )}
            </div>
            {!row.displayImageUrl && onUploadSlab ? (
              <label className={`mt-2 block text-xs ${ADMIN_TEXT_SECONDARY}`}>
                Register front
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-1 block w-full text-xs"
                  disabled={disabled || !row.certNumber}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    void handleUploadFace("front", file);
                  }}
                />
              </label>
            ) : null}
          </div>
          <div>
            <p className={`mb-1 text-xs font-medium ${ADMIN_TEXT_MUTED}`}>Back</p>
            <div className={ADMIN_COVER_BOX_CARD}>
              {resolvedBack ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolvedBack}
                  alt=""
                  className="max-h-full max-w-full object-contain p-2"
                />
              ) : (
                <span className={`text-sm ${ADMIN_TEXT_MUTED}`}>No back</span>
              )}
            </div>
            {!row.displayImageBackUrl && onUploadSlab ? (
              <label className={`mt-2 block text-xs ${ADMIN_TEXT_SECONDARY}`}>
                Register back
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-1 block w-full text-xs"
                  disabled={disabled || !row.certNumber}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    void handleUploadFace("back", file);
                  }}
                />
              </label>
            ) : null}
            {rowBusy === "upload-front" || rowBusy === "upload-back" ? (
              <p className={`mt-1 text-xs ${ADMIN_TEXT_META}`}>Uploading to S3…</p>
            ) : null}
            {!row.certNumber ? (
              <p className={`mt-1 text-xs ${ADMIN_TEXT_META}`}>
                Cert number required to store slab images
              </p>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-5">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-zinc-900 sm:text-xl">
              <Link
                href={`/marketplace/${row.tokenId}`}
                className={ADMIN_LINK}
              >
                Token #{row.tokenId}
              </Link>
            </h3>
            <p className={`font-mono text-sm ${ADMIN_TEXT_META}`}>
              Cert {row.certNumber ?? "—"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${statusTone}`}
              >
                {statusLabel}
              </span>
              {row.vaultCycleStatus ? (
                <span className={`text-xs ${ADMIN_TEXT_META}`}>
                  Cycle: {row.vaultCycleStatus}
                </span>
              ) : null}
            </div>
            <AdminMarketPriceStrip
              askUsd={row.hasActiveListing ? row.priceUsdc : undefined}
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
                <p className={`mt-2 truncate text-xs sm:text-sm ${ADMIN_TEXT_SECONDARY}`}>
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
              className={`${ADMIN_BTN_SECONDARY} disabled:opacity-40`}
            >
              {rowBusy === "clear" ? "Clearing…" : "Clear override"}
            </button>
            {onBurn ? (
              <button
                type="button"
                disabled={disabled || isBurning || !canBurn}
                title={
                  isBurned
                    ? "Already burned"
                    : row.hasActiveListing
                      ? "Cancels active listing, then on-chain adminBurn"
                      : "On-chain adminBurn (platform wallet)"
                }
                onClick={onBurn}
                className={ADMIN_BTN_DANGER}
              >
                {isBurning ? "Burning…" : isBurned ? "Burned" : "Burn token"}
              </button>
            ) : null}
            {pendingReleaseId && onConfirmRelease ? (
              <button
                type="button"
                disabled={disabled || isConfirmingRelease}
                title="Mark physical card shipped / released from vault"
                onClick={onConfirmRelease}
                className={ADMIN_BTN_PRIMARY}
              >
                {isConfirmingRelease ? "Confirming…" : "Confirm release"}
              </button>
            ) : null}
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
            <p className="text-sm text-red-600" role="alert">
              {rowError}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
