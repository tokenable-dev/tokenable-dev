"use client";

import { collectionCoverImageStyle } from "@/lib/marketplace/cardhedgerBubbleCoverImage";
import { COLLECTION_COVER_LIGHTBOX_FRAME_CLASS } from "./collectionCoverLightboxChrome";

export function CollectionCoverLightboxImage({
  src,
  alt,
  imageKey,
}: {
  src: string;
  alt: string;
  imageKey?: string;
}) {
  return (
    <div className={COLLECTION_COVER_LIGHTBOX_FRAME_CLASS}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={imageKey}
        src={src}
        alt={alt}
        className="h-full w-full object-contain object-center"
        style={collectionCoverImageStyle(src)}
        draggable={false}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
