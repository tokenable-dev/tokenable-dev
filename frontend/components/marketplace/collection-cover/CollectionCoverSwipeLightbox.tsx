"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useResolvedMediaUrl } from "@/hooks/media";
import type { CollectionBrowseEntry } from "@/lib/marketplace/collectionBrowseContext";
import {
  COLLECTION_COVER_LIGHTBOX_BACKDROP_CLASS,
  COLLECTION_COVER_LIGHTBOX_IMAGE_STAGE_CLASS,
  COLLECTION_COVER_LIGHTBOX_SWIPE_FOOTER_CLASS,
} from "./collectionCoverLightboxChrome";
import { CollectionCoverLightboxImage } from "./CollectionCoverLightboxImage";
import { useCollectionCoverLightboxPortal } from "./useCollectionCoverLightboxPortal";

const SWIPE_THRESHOLD_PX = 48;
const SWIPE_AXIS_LOCK_PX = 10;

function SwipeUpHintChevrons() {
  return (
    <div
      className="pointer-events-none flex flex-col items-center gap-0 text-white/55"
      aria-hidden
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
      </svg>
      <svg className="-mt-3 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

export function CollectionCoverSwipeLightbox({
  open,
  entries,
  viewingKey,
  currentIndex,
  canSwipe,
  onClose,
  onNext,
  onPrev,
}: {
  open: boolean;
  entries: CollectionBrowseEntry[];
  viewingKey: string;
  currentIndex: number;
  canSwipe: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const entry = entries[currentIndex] ?? entries.find((e) => e.collectionKey === viewingKey);
  const { url: resolvedUrl } = useResolvedMediaUrl(open && entry?.imageUrl ? entry.imageUrl : null);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchAxis = useRef<"none" | "horizontal" | "vertical">("none");
  const suppressCloseClickRef = useRef(false);

  const mounted = useCollectionCoverLightboxPortal(open, onClose);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!canSwipe) return;
      if (e.key === "ArrowUp") onNext();
      if (e.key === "ArrowDown") onPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onNext, onPrev, canSwipe]);

  const resetTouch = () => {
    touchStartX.current = null;
    touchStartY.current = null;
    touchAxis.current = "none";
  };

  if (!mounted || !open || !entry || !resolvedUrl) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      aria-label="Collection cover enlarged — tap anywhere to close, swipe up for next card"
      className={`${COLLECTION_COVER_LIGHTBOX_BACKDROP_CLASS} flex-col`}
      onClick={() => {
        if (suppressCloseClickRef.current) {
          suppressCloseClickRef.current = false;
          return;
        }
        onClose();
      }}
      onTouchStart={(e) => {
        if (!canSwipe) return;
        const t = e.changedTouches[0] ?? e.touches[0];
        if (!t) return;
        touchStartX.current = t.clientX;
        touchStartY.current = t.clientY;
        touchAxis.current = "none";
      }}
      onTouchMove={(e) => {
        if (!canSwipe) return;
        const startX = touchStartX.current;
        const startY = touchStartY.current;
        if (startX == null || startY == null) return;
        const t = e.changedTouches[0] ?? e.touches[0];
        if (!t) return;
        const dx = Math.abs(t.clientX - startX);
        const dy = Math.abs(t.clientY - startY);
        if (touchAxis.current === "none") {
          if (dx < SWIPE_AXIS_LOCK_PX && dy < SWIPE_AXIS_LOCK_PX) return;
          touchAxis.current = dy >= dx ? "vertical" : "horizontal";
        }
        if (touchAxis.current === "vertical") {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onTouchEnd={(e) => {
        if (!canSwipe) return;
        const startY = touchStartY.current;
        const axis = touchAxis.current;
        resetTouch();
        if (startY == null || axis !== "vertical") return;
        const t = e.changedTouches[0];
        if (!t) return;
        const dy = t.clientY - startY;
        if (dy <= -SWIPE_THRESHOLD_PX) {
          suppressCloseClickRef.current = true;
          e.preventDefault();
          e.stopPropagation();
          onNext();
        } else if (dy >= SWIPE_THRESHOLD_PX) {
          suppressCloseClickRef.current = true;
          e.preventDefault();
          e.stopPropagation();
          onPrev();
        }
      }}
      onTouchCancel={resetTouch}
    >
      <div className={COLLECTION_COVER_LIGHTBOX_IMAGE_STAGE_CLASS}>
        <CollectionCoverLightboxImage
          src={resolvedUrl}
          alt={entry.title || "Collection cover"}
          imageKey={viewingKey}
        />
      </div>

      <div className={COLLECTION_COVER_LIGHTBOX_SWIPE_FOOTER_CLASS}>
        <SwipeUpHintChevrons />
      </div>
    </div>,
    document.body,
  );
}
