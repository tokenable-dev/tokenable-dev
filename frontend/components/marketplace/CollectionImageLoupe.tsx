"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useResolvedMediaUrl } from "@/hooks/useResolvedMediaUrl";

const LENS_PX = 104;
const ZOOM = 2.25;

function computeContainRect(
  cw: number,
  ch: number,
  nw: number,
  nh: number,
): { x: number; y: number; w: number; h: number } {
  if (!nw || !nh || !cw || !ch) return { x: 0, y: 0, w: cw, h: ch };
  const scale = Math.min(cw / nw, ch / nh);
  const w = nw * scale;
  const h = nh * scale;
  const x = (cw - w) / 2;
  const y = (ch - h) / 2;
  return { x, y, w, h };
}

/**
 * Hover magnifier over the cover image (cursor-driven circular lens).
 * Correct for `object-contain` letterboxing.
 */
export function CollectionImageLoupe({
  imageUrl,
  alt,
  radiusClass,
  className = "",
  /** When true, omit ring/bg — use inside `CollectionCoverFrame` image well */
  embedInFrame = false,
}: {
  imageUrl: string;
  alt: string;
  radiusClass: string;
  className?: string;
  embedInFrame?: boolean;
}) {
  const { url: resolved } = useResolvedMediaUrl(imageUrl);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [box, setBox] = useState({ cw: 1, ch: 1 });

  const measure = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBox({ cw: r.width, ch: r.height });
  }, []);

  useEffect(() => {
    measure();
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNatural({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
    measure();
  };

  const onMove = (e: React.MouseEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const imgRect = computeContainRect(box.cw, box.ch, natural.w, natural.h);
  const lx = Math.min(Math.max(pos.x - imgRect.x, 0), imgRect.w);
  const ly = Math.min(Math.max(pos.y - imgRect.y, 0), imgRect.h);

  const zw = imgRect.w * ZOOM;
  const zh = imgRect.h * ZOOM;
  const imgLeft = Math.min(Math.max(LENS_PX / 2 - lx * ZOOM, LENS_PX - zw), 0);
  const imgTop = Math.min(Math.max(LENS_PX / 2 - ly * ZOOM, LENS_PX - zh), 0);

  const lensLeft = Math.min(
    Math.max(pos.x - LENS_PX / 2, 0),
    Math.max(0, box.cw - LENS_PX),
  );
  const lensTop = Math.min(
    Math.max(pos.y - LENS_PX / 2, 0),
    Math.max(0, box.ch - LENS_PX),
  );

  const showLens =
    active && natural.w > 0 && natural.h > 0 && box.cw > 24 && box.ch > 24;

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden cursor-zoom-in ${radiusClass} ${className} ${
        embedInFrame
          ? "bg-transparent"
          : "bg-[#030508] ring-1 ring-white/[0.07]"
      }`}
      onMouseEnter={() => {
        measure();
        setActive(true);
      }}
      onMouseLeave={() => setActive(false)}
      onMouseMove={(e) => {
        measure();
        onMove(e);
      }}
    >
      {resolved ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolved}
            alt={alt}
            className="relative z-0 block h-full w-full object-contain object-center select-none"
            style={{ filter: "saturate(1.04) contrast(1.02)" }}
            draggable={false}
            onLoad={onImgLoad}
          />
        </>
      ) : (
        <div className="relative z-0 block h-full w-full bg-gray-900/80 animate-pulse" aria-hidden />
      )}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-white/[0.045] to-transparent"
        aria-hidden
      />

      {showLens && resolved ? (
        <div
          className="pointer-events-none absolute z-10 rounded-full border-2 border-white/50 bg-black/15 shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-[0.5px] overflow-hidden"
          style={{
            width: LENS_PX,
            height: LENS_PX,
            left: lensLeft,
            top: lensTop,
          }}
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolved}
            alt=""
            className="absolute max-w-none select-none"
            style={{
              width: zw,
              height: zh,
              left: imgLeft,
              top: imgTop,
              objectFit: "fill",
            }}
            draggable={false}
          />
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute bottom-1.5 right-1.5 z-[5] flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/45 text-white/70 backdrop-blur-sm"
        aria-hidden
        title="Hover to magnify"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l5 5" />
        </svg>
      </div>
    </div>
  );
}
