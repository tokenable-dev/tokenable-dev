"use client";

import { useState, useRef, useCallback } from "react";

export interface NftImageZoomProps {
  src: string;
  alt?: string;
  className?: string;
  /** Magnification factor (default: 2.5) */
  zoomFactor?: number;
  /** Lens size in px (default: 150) */
  lensSize?: number;
}

/**
 * NFT image with magnifier lens on hover.
 * Base image stays unchanged; only the area under the cursor is shown zoomed.
 */
export function NftImageZoom({
  src,
  alt = "",
  className = "",
  zoomFactor = 2.5,
  lensSize = 150,
}: NftImageZoomProps) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 1, h: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const half = lensSize / 2;

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSize({ w: rect.width, h: rect.height });
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(false)}
      onMouseEnter={() => setHover(true)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover block select-none pointer-events-none"
        draggable={false}
      />

      {hover && (
        <div
          className="absolute pointer-events-none rounded-full border-2 border-white/80 shadow-xl"
          style={{
            width: lensSize,
            height: lensSize,
            left: pos.x - half,
            top: pos.y - half,
            backgroundImage: `url(${src})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${size.w * zoomFactor}px ${size.h * zoomFactor}px`,
            backgroundPosition: `${-pos.x * zoomFactor + half}px ${-pos.y * zoomFactor + half}px`,
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
