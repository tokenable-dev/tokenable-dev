"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  collectionDetailHref,
  readCollectionBrowseContext,
  type CollectionBrowseEntry,
} from "@/lib/marketplace/collectionBrowseContext";

export function useCollectionCoverGallery(
  collectionKey: string,
  router: AppRouterInstance,
) {
  const [context] = useState(() => readCollectionBrowseContext());
  const [viewingKey, setViewingKey] = useState(collectionKey);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setViewingKey(collectionKey);
  }, [collectionKey]);

  const entries = useMemo(() => context?.entries ?? [], [context]);

  const currentIndex = useMemo(
    () => entries.findIndex((e) => e.collectionKey === viewingKey),
    [entries, viewingKey],
  );

  const canSwipe = entries.length > 1 && currentIndex >= 0;

  const goToIndex = useCallback(
    (index: number) => {
      const entry = entries[index];
      if (entry) setViewingKey(entry.collectionKey);
    },
    [entries],
  );

  const goNext = useCallback(() => {
    if (!canSwipe) return;
    goToIndex((currentIndex + 1) % entries.length);
  }, [canSwipe, currentIndex, entries.length, goToIndex]);

  const goPrev = useCallback(() => {
    if (!canSwipe) return;
    goToIndex((currentIndex - 1 + entries.length) % entries.length);
  }, [canSwipe, currentIndex, entries.length, goToIndex]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    if (viewingKey !== collectionKey) {
      router.replace(collectionDetailHref(viewingKey), { scroll: false });
    }
  }, [collectionKey, router, viewingKey]);

  const openLightbox = useCallback(() => {
    setViewingKey(collectionKey);
    setLightboxOpen(true);
  }, [collectionKey]);

  const gallery: {
    entries: CollectionBrowseEntry[];
    viewingKey: string;
    currentIndex: number;
    canSwipe: boolean;
    onViewingKeyChange: (key: string) => void;
    onNext: () => void;
    onPrev: () => void;
  } | null = canSwipe
    ? {
        entries,
        viewingKey,
        currentIndex,
        canSwipe,
        onViewingKeyChange: setViewingKey,
        onNext: goNext,
        onPrev: goPrev,
      }
    : null;

  return {
    gallery,
    lightboxOpen,
    openLightbox,
    closeLightbox,
    setLightboxOpen,
  };
}
