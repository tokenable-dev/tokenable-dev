"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import {
  recordPricechartingHistory,
  uploadPricechartingCover,
} from "@/lib/core/api/marketplace-admin-pricecharting";
import { useResolvedMediaUrl } from "@/hooks/media";
import { useCollectionAdminCover } from "@/hooks/marketplace/collection-hero/useCollectionAdminCover";
import {
  formatReferencePercentChange,
  parseGradeScoreNumber,
  representativeGradeUsd,
  formatSportCategoryDisplayLabel,
} from "@/lib/market";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import { CollectionAiInsightPanel } from "@/components/marketplace/collection-ai-insight";
import { AdminMarketPriceStrip } from "./AdminMarketPriceStrip";
import { AdminMiniSparkline } from "./AdminMiniSparkline";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_DANGER_EMPHASIS,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_COVER_BOX,
  ADMIN_DETAILS_DANGER_SUMMARY,
  ADMIN_DETAILS_SUMMARY,
  ADMIN_INPUT_DANGER,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
  ADMIN_LINK,
  ADMIN_PANEL_DANGER_DARK,
  ADMIN_TEXT_EMPTY,
  ADMIN_TEXT_META,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";

/** Seoul calendar day as YYYY-MM-DD (PriceCharting history key). */
function seoulDateToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function statusBadgeClass(status: string | undefined): string {
  if (status === "pending_review") {
    return "bg-amber-100 text-amber-900 border-amber-300";
  }
  if (status === "rejected") {
    return "bg-red-100 text-red-800 border-red-300";
  }
  return "bg-emerald-100 text-emerald-900 border-emerald-300";
}

export function MarketplaceAdminCollectionRow({
  row,
  snapshot,
  busy,
  onCoverSaved,
  onDeleted,
  onApprove,
  onReject,
  onReopen,
}: {
  row: MarketplaceCollectionSummary;
  snapshot: CollectionListMarketSnapshot | undefined;
  busy: boolean;
  onCoverSaved: () => void;
  onDeleted: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onReopen?: () => void;
}) {
  const currentCoverUrl = row.coverImageUrl ?? row.displayImageUrl ?? "";
  const [urlInput, setUrlInput] = useState(currentCoverUrl);
  const [tokenIdInput, setTokenIdInput] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [aiInsightOpen, setAiInsightOpen] = useState(false);
  const [productCoverBusy, setProductCoverBusy] = useState(false);
  const [productCoverError, setProductCoverError] = useState<string | null>(null);
  const [priceDate, setPriceDate] = useState(seoulDateToday);
  const [looseUsd, setLooseUsd] = useState("");
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceOk, setPriceOk] = useState<string | null>(null);
  const isBox = row.components?.assetKind === "sealed_box";
  const productId =
    typeof row.components?.pricechartingProductId === "string"
      ? row.components.pricechartingProductId
      : "";
  const currentLooseCents =
    typeof row.components?.loosePriceCents === "number" &&
    Number.isFinite(row.components.loosePriceCents)
      ? row.components.loosePriceCents
      : null;

  const {
    busy: coverBusy,
    error: coverApiError,
    setError: setCoverApiError,
    saveCoverUrl,
    uploadCoverFile,
    fetchCoverFromToken,
    deleteCollection,
  } = useCollectionAdminCover({
    collectionKey: row.collectionKey,
    onSaved: onCoverSaved,
    onDeleted,
  });

  useEffect(() => {
    setUrlInput(currentCoverUrl);
    setPreviewUrl(null);
    setDeleteConfirm("");
    setValidationError(null);
    setCoverApiError(null);
    setAiInsightOpen(false);
    setPriceDate(seoulDateToday());
    setLooseUsd(
      typeof row.components?.loosePriceCents === "number" &&
        Number.isFinite(row.components.loosePriceCents) &&
        row.components.loosePriceCents > 0
        ? (row.components.loosePriceCents / 100).toFixed(2)
        : "",
    );
    setPriceError(null);
    setPriceOk(null);
  }, [row.collectionKey, currentCoverUrl, row.components?.loosePriceCents, setCoverApiError]);

  const rowError =
    validationError ?? coverApiError ?? productCoverError ?? priceError;

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

  const disabled = busy || coverBusy != null || productCoverBusy || priceBusy;

  async function saveBoxLoosePrice() {
    if (!productId || priceBusy) return;
    const trimmed = looseUsd.trim();
    if (!trimmed) {
      setPriceError("Enter a loose price in USD");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(priceDate)) {
      setPriceError("Pick a date (YYYY-MM-DD)");
      return;
    }
    setPriceBusy(true);
    setPriceError(null);
    setPriceOk(null);
    try {
      const saved = await recordPricechartingHistory({
        productId,
        observedOn: priceDate,
        prices: { loose_price_cents: trimmed },
        syncCurrent: true,
      });
      const cents = saved.savedCents.loose_price_cents;
      setPriceOk(
        cents != null
          ? `Saved Loose $${(cents / 100).toFixed(2)} for ${saved.observedOn}. Markets spot will refresh shortly.`
          : `Saved for ${saved.observedOn}.`,
      );
      onCoverSaved();
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "Could not save price");
    } finally {
      setPriceBusy(false);
    }
  }

  async function onProductCoverFile(file: File | null) {
    if (!file || !productId || productCoverBusy) return;
    setProductCoverBusy(true);
    setProductCoverError(null);
    try {
      const saved = await uploadPricechartingCover(productId, file);
      setUrlInput(saved.coverImageUrl);
      onCoverSaved();
    } catch (err) {
      setProductCoverError(err instanceof Error ? err.message : "Cover upload failed");
    } finally {
      setProductCoverBusy(false);
    }
  }
  const reviewStatus = row.reviewStatus ?? "active";
  // Boxes store PriceCharting productName / consoleName; graded cards use card* fields.
  const cardName = isBox
    ? row.components.productName?.trim() ||
      row.components.listingDisplayTitle?.trim() ||
      "—"
    : row.components.cardNameDisplay?.trim() ||
      row.components.cardName?.trim() ||
      row.components.listingDisplayTitle?.trim() ||
      "—";
  const setName = isBox
    ? row.components.consoleName?.trim() || "—"
    : row.components.cardSetDisplay?.trim() ||
      row.components.cardSet?.trim() ||
      "—";
  const gradeLabel = [
    row.components.gradingCompanyDisplay || row.components.gradingCompany,
    row.components.gradeScore,
  ]
    .filter(Boolean)
    .join(" ");
  const cardhedgerId =
    (typeof row.components.cardhedgerCardId === "string"
      ? row.components.cardhedgerCardId.trim()
      : "") ||
    snapshot?.cardhedgerPreview?.card?.id?.trim() ||
    "";

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

  async function onCoverFileSelected(file: File | null) {
    if (!file) return;
    setValidationError(null);
    setCoverApiError(null);
    const coverUrl = await uploadCoverFile(file);
    if (coverUrl) {
      setUrlInput(coverUrl);
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
    <article className={ADMIN_ARTICLE}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className={`${ADMIN_COVER_BOX} min-h-[14rem] lg:min-h-[18rem]`}>
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
            <span className={`text-sm ${ADMIN_TEXT_MUTED}`}>No cover</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold leading-snug text-zinc-900 sm:text-xl">
                  <Link
                    href={`/marketplace/collections/${encodeURIComponent(row.collectionKey)}`}
                    className={ADMIN_LINK}
                  >
                    {row.displayLabel || row.collectionKey}
                  </Link>
                </h3>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    row.components?.assetKind === "sealed_box"
                      ? "border-sky-200 bg-sky-50 text-sky-800"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700"
                  }`}
                >
                  {row.components?.assetKind === "sealed_box" ? "Box" : "Graded card"}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadgeClass(reviewStatus)}`}
                >
                  {reviewStatus.replace("_", " ")}
                </span>
              </div>
              <p className={`truncate font-mono text-xs sm:text-sm ${ADMIN_TEXT_META}`}>
                {row.collectionKey}
              </p>
              <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>
                <span className="font-semibold text-zinc-800">
                  {row.activeListingCount}
                </span>{" "}
                active listing{row.activeListingCount === 1 ? "" : "s"}
                {changePct != null && Number.isFinite(changePct) ? (
                  <>
                    {" "}
                    ·{" "}
                    <span
                      className={
                        changePct >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"
                      }
                    >
                      {formatReferencePercentChange(changePct)} ref
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            {lastTradeUsd != null ? (
              <div className="shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-right sm:px-4 sm:py-3">
                <span className={`text-xs font-semibold uppercase tracking-wider ${ADMIN_TEXT_META}`}>
                  Last trade
                </span>
                <p className="text-lg font-semibold text-zinc-900">
                  {formatUsdCompact(lastTradeUsd)}
                </p>
              </div>
            ) : null}
          </div>

          <section className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 sm:p-5">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-800">
              Review checklist
            </h4>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className={`text-xs font-medium ${ADMIN_TEXT_META}`}>
                  {isBox ? "Product" : "Card name"}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-zinc-900">{cardName}</dd>
              </div>
              <div>
                <dt className={`text-xs font-medium ${ADMIN_TEXT_META}`}>
                  {isBox ? "Console / set" : "Set"}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-zinc-900">{setName}</dd>
              </div>
              {!isBox ? (
                <div>
                  <dt className={`text-xs font-medium ${ADMIN_TEXT_META}`}>Grade</dt>
                  <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                    {gradeLabel || "—"}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className={`text-xs font-medium ${ADMIN_TEXT_META}`}>Category</dt>
                <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                  {formatSportCategoryDisplayLabel(
                    row.components.psaCategory?.trim() || "",
                  ) ||
                    row.components.genre?.trim() ||
                    snapshot?.categoryLabel?.trim() ||
                    "—"}
                </dd>
              </div>
              {isBox ? (
                <div className="sm:col-span-2 space-y-3 rounded-md border border-zinc-200 bg-white p-3">
                  <div>
                    <dt className={`text-xs font-medium ${ADMIN_TEXT_META}`}>
                      PriceCharting price
                    </dt>
                    <dd className={`mt-0.5 text-sm ${ADMIN_TEXT_SECONDARY}`}>
                      {productId ? (
                        <>
                          Product{" "}
                          <span className="font-mono text-zinc-800">{productId}</span>
                          {currentLooseCents != null ? (
                            <>
                              {" "}
                              · current Loose{" "}
                              <span className="font-semibold text-zinc-900">
                                ${(currentLooseCents / 100).toFixed(2)}
                              </span>
                            </>
                          ) : (
                            <span className="text-amber-700"> · no loose price yet</span>
                          )}
                        </>
                      ) : (
                        <span className="text-amber-700">
                          No PriceCharting product id on this collection
                        </span>
                      )}
                      {snapshot?.syncedAt ? (
                        <span className={`ml-2 text-xs ${ADMIN_TEXT_MUTED}`}>
                          snapshot {new Date(snapshot.syncedAt).toLocaleString()}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  {productId ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <label className="block min-w-0 flex-1">
                        <span className={ADMIN_LABEL}>Date (Seoul)</span>
                        <input
                          type="date"
                          value={priceDate}
                          disabled={disabled}
                          onChange={(e) => setPriceDate(e.target.value)}
                          className={`${ADMIN_INPUT_MONO} mt-1`}
                        />
                      </label>
                      <label className="block min-w-0 flex-1">
                        <span className={ADMIN_LABEL}>Loose (USD)</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="261.28"
                          value={looseUsd}
                          disabled={disabled}
                          onChange={(e) => setLooseUsd(e.target.value)}
                          className={`${ADMIN_INPUT_MONO} mt-1`}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={disabled || !looseUsd.trim() || !priceDate}
                        onClick={() => void saveBoxLoosePrice()}
                        className={ADMIN_BTN_PRIMARY}
                      >
                        {priceBusy ? "Saving…" : "Save price"}
                      </button>
                    </div>
                  ) : null}
                  {priceOk ? (
                    <p className="text-sm text-emerald-700" role="status">
                      {priceOk}
                    </p>
                  ) : null}
                  <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>
                    Writes that day into PriceCharting history, updates the catalog
                    loose price and this collection spot, then refreshes the Markets
                    snapshot.
                  </p>
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <dt className={`text-xs font-medium ${ADMIN_TEXT_META}`}>
                    Cardhedger
                  </dt>
                  <dd className="mt-0.5 text-sm text-zinc-900">
                    {cardhedgerId ? (
                      <span className="font-mono text-xs sm:text-sm">{cardhedgerId}</span>
                    ) : (
                      <span className="text-amber-700">Missing cardhedgerCardId</span>
                    )}
                    {snapshot?.syncedAt ? (
                      <span className={`ml-2 text-xs ${ADMIN_TEXT_MUTED}`}>
                        synced {new Date(snapshot.syncedAt).toLocaleString()}
                      </span>
                    ) : null}
                    {snapshot?.snapshotStale ? (
                      <span className="ml-2 text-xs font-medium text-amber-700">
                        stale snapshot
                      </span>
                    ) : null}
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <AdminMarketPriceStrip refUsd={refUsd} floorUsd={floorUsd} compact />
              </div>
              <div className="shrink-0">
                <p className={`mb-1 text-xs font-medium ${ADMIN_TEXT_META}`}>
                  Price chart
                </p>
                <AdminMiniSparkline points={snapshot?.sparklineUsd ?? []} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {reviewStatus === "pending_review" ? (
                <>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onApprove?.()}
                    className={ADMIN_BTN_PRIMARY}
                  >
                    Approve for Markets
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onReject?.()}
                    className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              ) : null}
              {reviewStatus === "rejected" ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onReopen?.()}
                  className={ADMIN_BTN_SECONDARY}
                >
                  Move to pending
                </button>
              ) : null}
              {reviewStatus === "active" ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onReopen?.()}
                  className={ADMIN_BTN_SECONDARY}
                >
                  Revert to pending
                </button>
              ) : null}
            </div>
          </section>

          {!isBox ? (
            <details
              className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5"
              open={aiInsightOpen}
              onToggle={(e) => setAiInsightOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className={`${ADMIN_DETAILS_SUMMARY} text-zinc-900`}>
                AI Insight (admin preview)
              </summary>
              <div className="mt-4">
                <CollectionAiInsightPanel
                  row={row}
                  snapshot={snapshot}
                  enabled={aiInsightOpen}
                  variant="light"
                />
              </div>
            </details>
          ) : null}

          <details className="rounded-lg border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <summary className={`${ADMIN_DETAILS_SUMMARY} text-amber-900`}>
              {isBox ? "Representative image" : "Cover image"}
            </summary>
            {isBox ? (
              <div className="mt-4 space-y-3">
                <p className={`text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
                  Saved on the PriceCharting product as cover_image_url. Collection
                  detail uses it, and a partner can mint with it when they do not
                  upload their own photo.
                </p>
                {productId ? (
                  <label className="block">
                    <span className={ADMIN_LABEL}>
                      Upload to S3 (JPEG / PNG / WebP, max 8MB)
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={disabled}
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        void onProductCoverFile(file);
                      }}
                      className="mt-1 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-50 disabled:opacity-50"
                    />
                  </label>
                ) : (
                  <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>
                    This box collection has no PriceCharting product id.
                  </p>
                )}
              </div>
            ) : (
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className={ADMIN_LABEL}>Upload to S3 (JPEG / PNG / WebP, max 8MB)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={disabled}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void onCoverFileSelected(file);
                  }}
                  className="mt-1 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-50 disabled:opacity-50"
                />
                <p className={`mt-1 text-xs ${ADMIN_TEXT_MUTED}`}>
                  {coverBusy === "upload"
                    ? "Overwriting S3 cover and saving…"
                    : "Overwrites this collection’s stable S3 cover object and updates coverImageUrl."}
                </p>
              </label>

              <label className="block">
                <span className={ADMIN_LABEL}>Cover URL (https or ipfs)</span>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setPreviewUrl(null);
                  }}
                  placeholder="https://…"
                  className={ADMIN_INPUT_MONO}
                />
              </label>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void saveUrl()}
                className={ADMIN_BTN_PRIMARY}
              >
                {coverBusy === "url" ? "Saving…" : "Save cover URL"}
              </button>

              <div className="border-t border-zinc-200 pt-4">
                <span className={ADMIN_LABEL}>From token metadata</span>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tokenIdInput}
                    onChange={(e) => setTokenIdInput(e.target.value)}
                    placeholder="Token ID"
                    className={`${ADMIN_INPUT_MONO} w-full max-w-[8rem] sm:w-32`}
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void fetchFromToken(false)}
                    className={ADMIN_BTN_SECONDARY}
                  >
                    {coverBusy === "fetch" ? "Fetching…" : "Preview"}
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void fetchFromToken(true)}
                    className="rounded-md border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-50"
                  >
                    {coverBusy === "apply" ? "Applying…" : "Fetch and save"}
                  </button>
                </div>
              </div>
            </div>
            )}
          </details>

          <details className={ADMIN_PANEL_DANGER_DARK}>
            <summary className={ADMIN_DETAILS_DANGER_SUMMARY}>
              Delete collection
            </summary>
            <p className={`mt-3 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
              Removes snapshots, orders, rwa_tokens rows, and the collection row.
              On-chain RWAs are not burned. Type the collection key to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={row.collectionKey.slice(0, 24) + "…"}
              className={`${ADMIN_INPUT_DANGER} mt-3`}
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              disabled={disabled || !deleteKeyMatches}
              onClick={() => {
                if (
                  !window.confirm(
                    "Delete this collection from the marketplace? Listings and snapshots for this bucket are removed. RWAs stay in wallets and the mint registry (portfolio is not wiped).",
                  )
                ) {
                  return;
                }
                setValidationError(null);
                setCoverApiError(null);
                void deleteCollection(deleteConfirm.trim());
              }}
              className={`${ADMIN_BTN_DANGER_EMPHASIS} mt-3`}
            >
              {coverBusy === "delete" ? "Deleting…" : "Delete permanently"}
            </button>
          </details>

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
