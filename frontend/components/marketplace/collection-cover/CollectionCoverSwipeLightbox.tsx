"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";
import { useResolvedMediaUrl } from "@/hooks/media";
import { collectionCoverImageStyle } from "@/lib/marketplace/cardhedgerBubbleCoverImage";
import type { CollectionBrowseEntry } from "@/lib/marketplace/collectionBrowseContext";

const SWIPE_THRESHOLD_PX = 48;
const SWIPE_AXIS_LOCK_PX = 10;

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
  const [mounted, setMounted] = useState(false);
  const entry = entries[currentIndex] ?? entries.find((e) => e.collectionKey === viewingKey);
  const { url: resolvedUrl } = useResolvedMediaUrl(open && entry?.imageUrl ? entry.imageUrl : null);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchAxis = useRef<"none" | "horizontal" | "vertical">("none");
  const suppressCloseClickRef = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (!canSwipe) return;
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, onNext, onPrev, canSwipe]);

  const resetTouch = () => {
    touchStartX.current = null;
    touchStartY.current = null;
    touchAxis.current = "none";
  };

  if (!mounted || !open || !entry || !resolvedUrl) return null;

  return createPortal(
    <button
      type="button"
      role="dialog"
      aria-modal
      aria-label="Collection cover enlarged — tap anywhere to close"
      onClick={() => {
        if (suppressCloseClickRef.current) {
          suppressCloseClickRef.current = false;
          return;
        }
        onClose();
      }}
      className="fixed inset-0 z-[100] flex cursor-default items-center justify-center bg-black/88 p-4 backdrop-blur-[2px] sm:p-8"
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
        if (startX == null || startY == null || touchAxis.current !== "none") return;
        const t = e.changedTouches[0] ?? e.touches[0];
        if (!t) return;
        const dx = Math.abs(t.clientX - startX);
        const dy = Math.abs(t.clientY - startY);
        if (dx < SWIPE_AXIS_LOCK_PX && dy < SWIPE_AXIS_LOCK_PX) return;
        touchAxis.current = dx > dy ? "horizontal" : "vertical";
      }}
      onTouchEnd={(e) => {
        if (!canSwipe) return;
        const startX = touchStartX.current;
        const axis = touchAxis.current;
        resetTouch();
        if (startX == null || axis !== "horizontal") return;
        const t = e.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - startX;
        if (dx <= -SWIPE_THRESHOLD_PX) {
          suppressCloseClickRef.current = true;
          onNext();
        } else if (dx >= SWIPE_THRESHOLD_PX) {
          suppressCloseClickRef.current = true;
          onPrev();
        }
      }}
      onTouchCancel={resetTouch}
    >
      <div
        className={`max-h-[min(92vh,900px)] w-full max-w-[min(96vw,560px)] overflow-hidden rounded-2xl ${COLLECTION_DETAILS_BORDER_ALL} bg-black shadow-[0_28px_80px_-24px_rgba(0,0,0,0.85)] ring-1 ring-black`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={viewingKey}
          src={resolvedUrl}
          alt={entry.title || "Collection cover"}
          className="max-h-[min(82vh,820px)] w-full object-contain object-center"
          style={collectionCoverImageStyle(resolvedUrl)}
          draggable={false}
        />
      </div>
    </button>,
    document.body,
  );
}
