"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { Order, RwaMetadata } from "@/lib/core";
import { marketplaceRqPolicy, postResolveMediaUrls } from "@/lib/core";
import { TkButton } from "@/components/ds";
import { useCollectionRwaCardData } from "@/hooks/collection-listings/useCollectionRwaCardData";
import {
  formatListingUsdc,
  listingAssetTitle,
  listingGalleryImages,
  listingSellerVerifiedLabel,
  listingVaultBadge,
  listingVerificationTiles,
} from "@/lib/marketplace/collectionListingModalHelpers";
import { buildRwaDetailMobileTrustView } from "@/lib/marketplace/rwa-detail/rwaDetailMetadata";
import { resolveRwaHeadlineGrade } from "@/lib/marketplace/assetDetailHeadline";

const LISTING_IMAGE_ZOOM = 2.5;

function listingImageZoomAtPointer(
  area: HTMLElement,
  mainImg: HTMLImageElement,
  clientX: number,
  clientY: number,
): { originX: number; originY: number } {
  const rect = area.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const imgRect = mainImg.getBoundingClientRect();
  const imgX = imgRect.left - rect.left;
  const imgY = imgRect.top - rect.top;
  return {
    originX: ((x - imgX) / imgRect.width) * 100,
    originY: ((y - imgY) / imgRect.height) * 100,
  };
}

function formatListedAt(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function psaCertHref(certNumber: string): string | null {
  const n = certNumber.replace(/\D/g, "");
  if (n.length < 6) return null;
  return `https://www.psacard.com/cert/${n}`;
}

/**
 * Card.html `#tk-prov` — Listing details before Checkout.
 */
export function CollectionListingDetailModal({
  open,
  tokenId,
  listing,
  prefetchedMetadata,
  prefetchedImageUrl,
  onClose,
  onBuy,
  onBid,
}: {
  open: boolean;
  tokenId: number | null;
  listing: Order | null;
  prefetchedMetadata?: RwaMetadata | null;
  prefetchedImageUrl?: string | null;
  onClose: () => void;
  onBuy: () => void;
  onBid?: () => void;
}) {
  const tid = tokenId ?? 0;
  const { metadata, imageUrl } = useCollectionRwaCardData({
    tokenId: tid,
    prefetchedMetadata: prefetchedMetadata ?? null,
    prefetchedImageUrl: prefetchedImageUrl ?? null,
  });

  const rawGallery = useMemo(
    () => listingGalleryImages(metadata, imageUrl ?? prefetchedImageUrl),
    [metadata, imageUrl, prefetchedImageUrl],
  );

  const unresolvedUris = useMemo(
    () =>
      rawGallery
        .map((item) => item.src)
        .filter((src) => !/^https?:\/\//i.test(src)),
    [rawGallery],
  );

  const { data: resolvedMedia } = useQuery({
    queryKey: ["listing-gallery-media", tokenId, unresolvedUris.join("|")],
    queryFn: () => postResolveMediaUrls(unresolvedUris),
    enabled: open && unresolvedUris.length > 0,
    staleTime: marketplaceRqPolicy.mediaStaleMs,
  });

  const thumbs = useMemo(() => {
    const resolvedBySource = new Map(
      (resolvedMedia?.items ?? []).map((item) => [item.uri, item.httpsUrl]),
    );
    return rawGallery
      .map((item) => {
        const resolved = resolvedBySource.get(item.src);
        const src =
          resolved?.trim() ||
          (/^https?:\/\//i.test(item.src) ? item.src : null);
        return src ? { ...item, src } : null;
      })
      .filter((item): item is { id: string; label: string; src: string } => item != null);
  }, [rawGallery, resolvedMedia?.items]);

  const [activeThumbId, setActiveThumbId] = useState<string | null>(null);

  const mainSrc = useMemo(() => {
    if (activeThumbId) {
      const hit = thumbs.find((t) => t.id === activeThumbId);
      if (hit) return hit.src;
    }
    const front = thumbs.find((t) => t.label.startsWith("Front"))?.src;
    return front ?? thumbs[0]?.src ?? null;
  }, [thumbs, activeThumbId]);

  const [fullScreen, setFullScreen] = useState(false);
  const [protectionOpen, setProtectionOpen] = useState(false);
  const imgAreaRef = useRef<HTMLDivElement>(null);
  const mainImgRef = useRef<HTMLImageElement>(null);
  const [zoomHintHidden, setZoomHintHidden] = useState(false);
  const [imgZoom, setImgZoom] = useState({
    scale: 1,
    originX: 50,
    originY: 50,
  });

  const resetImgZoom = useCallback(() => {
    setZoomHintHidden(false);
    setImgZoom({ scale: 1, originX: 50, originY: 50 });
  }, []);

  const handleImgMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const area = imgAreaRef.current;
    const mainImg = mainImgRef.current;
    if (!area || !mainImg) return;
    const { originX, originY } = listingImageZoomAtPointer(
      area,
      mainImg,
      e.clientX,
      e.clientY,
    );
    setZoomHintHidden(true);
    setImgZoom({ scale: LISTING_IMAGE_ZOOM, originX, originY });
  }, []);

  const handleImgMouseLeave = useCallback(() => {
    resetImgZoom();
  }, [resetImgZoom]);

  const title = listingAssetTitle(metadata, tid);
  const tiles = listingVerificationTiles(metadata);
  const trust = buildRwaDetailMobileTrustView(metadata);
  const grade = resolveRwaHeadlineGrade(metadata);
  const price =
    listing != null ? formatListingUsdc(listing.considerationAmount) : "—";
  const sellerLine = listingSellerVerifiedLabel(listing);
  const vaultBadge = listingVaultBadge(listing);
  const listedAt = formatListedAt(listing?.createdAt);
  const certHref =
    tiles.certNumber !== "—" ? psaCertHref(tiles.certNumber) : null;
  const storedAt =
    vaultBadge.label !== "—" ? vaultBadge.label : tiles.storedAt;

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (fullScreen) setFullScreen(false);
        else onClose();
      }
    },
    [fullScreen, onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [open, handleKey]);

  useEffect(() => {
    if (open) {
      resetImgZoom();
      setActiveThumbId(null);
      setProtectionOpen(false);
    }
  }, [open, tokenId, resetImgZoom]);

  useEffect(() => {
    resetImgZoom();
  }, [mainSrc, resetImgZoom]);

  if (!open || tokenId == null || typeof document === "undefined") return null;

  const sellerHandle =
    listing?.sellerDisplayName?.trim() ||
    (sellerLine.title ? sellerLine.label : null);

  return createPortal(
    <>
      <div
        className="cd-listing-prov"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cd-listing-prov-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="cd-listing-prov__panel cd-notch">
          <div className="cd-listing-prov__head">
            <h2 id="cd-listing-prov-title" className="cd-listing-prov__title">
              Listing details
            </h2>
            <button
              type="button"
              className="cd-listing-prov__close"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </div>

          <div
            ref={imgAreaRef}
            className="cd-listing-prov__img-area"
            onClick={() => setFullScreen(true)}
            onMouseMove={handleImgMouseMove}
            onMouseLeave={handleImgMouseLeave}
          >
            {mainSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={mainImgRef}
                src={mainSrc}
                alt={title}
                className="cd-listing-prov__main-img"
                style={{
                  transform: `scale(${imgZoom.scale})`,
                  transformOrigin: `${imgZoom.originX}% ${imgZoom.originY}%`,
                }}
              />
            ) : (
              <div className="cd-listing-prov__img-empty">No image</div>
            )}
            <span
              className={`cd-listing-prov__zoom-hint max-md:hidden${
                zoomHintHidden ? " cd-listing-prov__zoom-hint--hidden" : ""
              }`}
            >
              Hover to zoom
            </span>
            <span className="cd-listing-prov__tap-hint md:hidden">Tap to enlarge</span>
          </div>

          {thumbs.length > 1 ? (
            <div className="cd-listing-prov__thumbs">
              {thumbs.map((t) => {
                const active = (activeThumbId ?? thumbs[0]?.id) === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`cd-listing-prov__thumb${active ? " cd-listing-prov__thumb--active" : ""}`}
                    onClick={() => setActiveThumbId(t.id)}
                    aria-label={t.label}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.src} alt="" />
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="cd-listing-prov__section-label">Verification</div>
          <div className="cd-listing-prov__verify-grid cd-listing-prov__verify-grid--3">
            <div className="cd-listing-prov__verify-cell">
              <div className="cd-listing-prov__verify-k">Graded by</div>
              <div className="cd-listing-prov__verify-v">{tiles.gradedBy}</div>
            </div>
            <div className="cd-listing-prov__verify-cell">
              <div className="cd-listing-prov__verify-k">Cert #</div>
              {certHref ? (
                <a
                  href={certHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cd-listing-prov__verify-v cd-listing-prov__verify-v--link tkl-mono"
                  onClick={(e) => e.stopPropagation()}
                >
                  {tiles.certNumber}{" "}
                  <span className="cd-listing-prov__verify-ext">Verify on PSA ↗</span>
                </a>
              ) : (
                <div className="cd-listing-prov__verify-v tkl-mono">{tiles.certNumber}</div>
              )}
            </div>
            <div className="cd-listing-prov__verify-cell">
              <div className="cd-listing-prov__verify-k">Stored at</div>
              <div className="cd-listing-prov__verify-v">{storedAt}</div>
            </div>
          </div>

          <div className="cd-listing-prov__section-label">
            Provenance · this copy&apos;s journey
          </div>
          <div className="cd-listing-prov__timeline">
            <div className="cd-listing-prov__timeline-line" aria-hidden />
            <div className="cd-listing-prov__timeline-item">
              <div className="cd-listing-prov__timeline-dot cd-listing-prov__timeline-dot--active" />
              <div>
                <div className="cd-listing-prov__timeline-title">
                  Listed · ${price}{" "}
                  <span className="cd-listing-prov__current-tag tkl-mono">CURRENT</span>
                </div>
                <div className="cd-listing-prov__timeline-meta tkl-mono">
                  {[listedAt, sellerHandle ? `by owner “${sellerHandle}”` : null]
                    .filter(Boolean)
                    .join(" · ") || `Listed at $${price}`}
                </div>
              </div>
            </div>
            <div className="cd-listing-prov__timeline-item">
              <div className="cd-listing-prov__timeline-dot" />
              <div>
                <div className="cd-listing-prov__timeline-title cd-listing-prov__timeline-title--muted">
                  Vaulted and tokenized
                </div>
                <div className="cd-listing-prov__timeline-meta tkl-mono">
                  Entered the vault
                  {grade ? ` · ${grade}` : ""}
                  {trust.certNumber ? ` · Cert #${trust.certNumber}` : ""}
                </div>
              </div>
            </div>
          </div>

          <div className="cd-listing-prov__wyg">
            <div className="cd-listing-prov__wyg-label tkl-mono">What you&apos;ll get</div>
            <p className="cd-listing-prov__wyg-body">
              You&apos;ll own this card instantly. It stays safely in the vault — no
              shipping. Want the physical card? Redeem it anytime from your portfolio.
            </p>
          </div>

          <details
            className="cd-listing-prov__protect"
            open={protectionOpen}
            onToggle={(e) => setProtectionOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cd-listing-prov__protect-sum">
              Buyer protection
              <span className="cd-listing-prov__protect-view tkl-mono">
                {protectionOpen ? "Hide ↑" : "View ↓"}
              </span>
            </summary>
            <div className="cd-listing-prov__protect-body">
              <p>
                Every card is graded, vaulted, and insured while in storage:
              </p>
              <div className="cd-listing-prov__protect-row">
                <span aria-hidden>✓</span>
                <span>
                  Held in a PSA or partner vault — insured against loss or damage while
                  stored
                </span>
              </div>
              <div className="cd-listing-prov__protect-row">
                <span aria-hidden>✓</span>
                <span>
                  Ownership transfers instantly — no shipping, nothing to arrange
                </span>
              </div>
              <div className="cd-listing-prov__protect-row">
                <span aria-hidden>✓</span>
                <span>
                  Want the physical card? Redeem it anytime from your portfolio
                </span>
              </div>
            </div>
          </details>

          <div className="cd-listing-prov__foot">
            <div className="cd-listing-prov__foot-top">
              <span className="cd-listing-prov__price">${price}</span>
              <span
                className={`cd-listing-prov__seller tkl-mono cd-listing-card__vault--${sellerLine.tone}`}
                title={sellerLine.title}
              >
                {sellerLine.label}
              </span>
            </div>
            <div className="cd-listing-prov__actions cd-listing-prov__actions--stack">
              <TkButton
                type="button"
                variant="primary"
                size="sm"
                className="cd-listing-prov__btn cd-listing-prov__btn--buy"
                onClick={onBuy}
              >
                Buy now
              </TkButton>
              {onBid ? (
                <TkButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="cd-listing-prov__btn cd-listing-prov__btn--bid"
                  onClick={onBid}
                >
                  or place a bid
                </TkButton>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {fullScreen && mainSrc ? (
        <div
          className="cd-listing-prov-fullimg"
          role="presentation"
          onClick={() => setFullScreen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mainSrc} alt={title} className="cd-listing-prov-fullimg__img" />
          <button
            type="button"
            className="cd-listing-prov-fullimg__close"
            aria-label="Close fullscreen"
            onClick={() => setFullScreen(false)}
          >
            ×
          </button>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
