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
  listingVerificationTiles,
  shortenWallet,
} from "@/lib/marketplace/collectionListingModalHelpers";

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
  onBid: () => void;
}) {
  const tid = tokenId ?? 0;
  const { metadata, imageUrl } = useCollectionRwaCardData({
    tokenId: tid,
    prefetchedMetadata: prefetchedMetadata ?? null,
    prefetchedImageUrl: prefetchedImageUrl ?? null,
  });

  const rawGallery = useMemo(
    () => listingGalleryImages(metadata, imageUrl),
    [metadata, imageUrl],
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

  const faces = useMemo(() => {
    const front = thumbs.find((t) => t.label.startsWith("Front"))?.src ?? thumbs[0]?.src ?? null;
    const back = thumbs.find((t) => t.label.startsWith("Back"))?.src ?? null;
    return { front, back };
  }, [thumbs]);

  const [activeThumb, setActiveThumb] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
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

  const mainSrc = thumbs[activeThumb]?.src ?? faces.front;
  const title = listingAssetTitle(metadata, tid);
  const tiles = listingVerificationTiles(metadata);
  const price =
    listing != null ? formatListingUsdc(listing.considerationAmount) : "—";
  const seller = shortenWallet(
    listing?.offerer || listing?.parameters?.offerer,
  );

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
      setActiveThumb(0);
      resetImgZoom();
    }
  }, [open, tokenId, resetImgZoom]);

  useEffect(() => {
    if (activeThumb >= thumbs.length) setActiveThumb(0);
  }, [activeThumb, thumbs.length]);

  useEffect(() => {
    resetImgZoom();
  }, [activeThumb, mainSrc, resetImgZoom]);

  if (!open || tokenId == null || typeof document === "undefined") return null;

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

          {thumbs.length > 0 ? (
            <div className="cd-listing-prov__thumbs" id="prov-thumbs">
              {thumbs.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  className={`cd-listing-prov__thumb prov-thumb${i === activeThumb ? " cd-listing-prov__thumb--active active" : ""}`}
                  onClick={() => setActiveThumb(i)}
                  aria-label={`Show ${t.label}`}
                  title={t.label}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.src} alt={t.label} />
                </button>
              ))}
            </div>
          ) : null}

          <div className="cd-listing-prov__section-label">Verification</div>
          <div className="cd-listing-prov__verify-grid">
            <div className="cd-listing-prov__verify-cell">
              <div className="cd-listing-prov__verify-k">Graded by</div>
              <div className="cd-listing-prov__verify-v">{tiles.gradedBy}</div>
            </div>
            <div className="cd-listing-prov__verify-cell">
              <div className="cd-listing-prov__verify-k">Cert #</div>
              <div className="cd-listing-prov__verify-v tkl-mono">{tiles.certNumber}</div>
            </div>
            <div className="cd-listing-prov__verify-cell">
              <div className="cd-listing-prov__verify-k">Vault</div>
              <div className="cd-listing-prov__verify-v">{tiles.vault}</div>
            </div>
            <div className="cd-listing-prov__verify-cell">
              <div className="cd-listing-prov__verify-k">Token</div>
              <div className="cd-listing-prov__verify-v cd-listing-prov__verify-v--link tkl-mono">
                #{tokenId}
              </div>
            </div>
          </div>

          <div className="cd-listing-prov__section-label">
            Provenance · Ownership history
          </div>
          <div className="cd-listing-prov__timeline">
            <div className="cd-listing-prov__timeline-line" aria-hidden />
            <div className="cd-listing-prov__timeline-item">
              <div className="cd-listing-prov__timeline-dot cd-listing-prov__timeline-dot--active" />
              <div>
                <div className="cd-listing-prov__timeline-title">Current listing</div>
                <div className="cd-listing-prov__timeline-addr tkl-mono">{seller}</div>
                <div className="cd-listing-prov__timeline-meta tkl-mono">
                  Listed at ${price}
                </div>
              </div>
            </div>
          </div>

          <div className="cd-listing-prov__foot">
            <div className="cd-listing-prov__foot-top">
              <span className="cd-listing-prov__price">${price}</span>
              <span className="cd-listing-prov__seller tkl-mono">Seller: {seller}</span>
            </div>
            <div className="cd-listing-prov__actions">
              <TkButton
                type="button"
                variant="primary"
                size="sm"
                className="cd-listing-prov__btn"
                onClick={onBuy}
              >
                Buy
              </TkButton>
              <TkButton
                type="button"
                variant="neutral"
                size="sm"
                className="cd-listing-prov__btn"
                onClick={onBid}
              >
                Bid
              </TkButton>
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
