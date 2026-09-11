"use client";

import { createPortal } from "react-dom";
import { COLLECTION_COVER_LIGHTBOX_BACKDROP_CLASS } from "./collectionCoverLightboxChrome";
import { CollectionCoverLightboxImage } from "./CollectionCoverLightboxImage";
import { useCollectionCoverLightboxPortal } from "./useCollectionCoverLightboxPortal";

export function CollectionCoverLightbox({
  open,
  resolvedUrl,
  alt,
  onClose,
}: {
  open: boolean;
  resolvedUrl: string | null;
  alt: string;
  onClose: () => void;
}) {
  const mounted = useCollectionCoverLightboxPortal(open, onClose);

  if (!mounted || !open || !resolvedUrl) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      aria-label="Collection cover enlarged — tap anywhere to close"
      onClick={onClose}
      className={`${COLLECTION_COVER_LIGHTBOX_BACKDROP_CLASS} items-center justify-center p-4 sm:p-8`}
    >
      <CollectionCoverLightboxImage src={resolvedUrl} alt={alt || "Collection cover"} />
    </div>,
    document.body,
  );
}
