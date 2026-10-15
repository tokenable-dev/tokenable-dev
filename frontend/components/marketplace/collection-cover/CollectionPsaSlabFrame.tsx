"use client";

import { useEffect, useState } from "react";
import { ASSETS } from "@/constants/assets";
import { useResolvedMediaUrl } from "@/hooks/media";
import {
  type CollectionCoverChamberFit,
  collectionCoverChamberImageStyle,
} from "@/lib/marketplace/cardhedgerBubbleCoverImage";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { buildCollectionPsaSlabLabelFields } from "@/lib/marketplace/slabDisplayTitle";

export interface CollectionPsaSlabFrameProps {
  imageUrl: string;
  alt?: string;
  comp: CollectionComponents;
  displayLabel?: string | null;
  collectionKey?: string;
  className?: string;
  /**
   * `fill` — listing grids (stretch to chamber, mixed aspect ratios).
   * `contain` — collection detail hero (same as `CollectionCoverFrame` hero).
   */
  chamberFit?: CollectionCoverChamberFit;
}

/** Decorative label barcode — collection slabs have no cert, so this encodes nothing. */
const BARCODE_BARS = [
  2, 1, 1, 2, 1, 1, 3, 1, 1, 2, 2, 1, 1, 1, 2, 3, 1, 1, 1, 2, 1, 2, 1, 1, 3, 1, 2, 1, 1, 1, 2, 2,
  1, 3, 1, 1, 2, 1, 1, 2, 1, 1, 3, 2, 1, 1, 2, 1,
];

function SlabBarcode() {
  let x = 0;
  const rects: { x: number; w: number }[] = [];
  BARCODE_BARS.forEach((w, i) => {
    if (i % 2 === 0) rects.push({ x, w });
    x += w;
  });
  return (
    <svg
      className="psa-slab__barcode"
      viewBox={`0 0 ${x} 10`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {rects.map((r) => (
        <rect key={r.x} x={r.x} y={0} width={r.w} height={10} fill="currentColor" />
      ))}
    </svg>
  );
}

/**
 * Collection cover inside a PSA holder. Every collection representative image uses this frame.
 * Label prints collection-level fields from `lib/marketplace/slabDisplayTitle` — no cert number.
 */
export function CollectionPsaSlabFrame({
  imageUrl,
  alt = "",
  comp,
  displayLabel,
  collectionKey,
  className = "",
  chamberFit = "fill",
}: CollectionPsaSlabFrameProps) {
  const { url: resolved, isLoading } = useResolvedMediaUrl(imageUrl);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [resolved]);

  const label = buildCollectionPsaSlabLabelFields({ comp, displayLabel, collectionKey });

  return (
    <div className={`psa-slab-frame ${className}`.trim()}>
      <div className="psa-slab">
        <span className="psa-slab__bevel" aria-hidden />

        <div className="psa-slab__label" aria-hidden>
          <div className="psa-slab__label-face">
            <div className="psa-slab__label-grid">
              <span className="psa-slab__label-left">{label.setLine}</span>
              <span className="psa-slab__label-right">{label.cardNumber ?? ""}</span>
              <span className="psa-slab__label-left">{label.cardName}</span>
              <span className="psa-slab__label-right">{label.gradeName}</span>
              <span className="psa-slab__label-left">{label.variety ?? ""}</span>
              <span className="psa-slab__label-right">{label.gradeScore}</span>
            </div>
            <SlabBarcode />
          </div>
          <div className="psa-slab__tag">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="psa-slab__tag-logo" src={ASSETS.icons.psaLabelLogo} alt="" />
          </div>
        </div>

        <span className="psa-slab__chamber" aria-hidden />

        <div className="psa-slab__card">
          {resolved && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolved}
              alt={alt}
              className={`psa-slab__card-img psa-slab__card-img--${chamberFit}`}
              style={collectionCoverChamberImageStyle(resolved, chamberFit)}
              onError={() => setImgFailed(true)}
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
            />
          ) : imgFailed ? (
            <div className="psa-slab__placeholder" role="img">
              Couldn&apos;t load image
            </div>
          ) : isLoading ? (
            <div className="psa-slab__placeholder psa-slab__placeholder--load" aria-hidden />
          ) : (
            <div className="psa-slab__placeholder">No preview</div>
          )}
        </div>
      </div>
    </div>
  );
}
