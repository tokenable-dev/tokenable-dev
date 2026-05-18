"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Smooth Y-axis slab flip — front/back are flat faces; swipe or tabs drive rotation. */

const FLIP_EASE_MS = "transform 520ms cubic-bezier(0.32, 0.72, 0.2, 1)";
const FLIP_EASE_REDUCED_MS = "transform 80ms linear";

interface SlabCardFlipProps {
  frontSrc: string;
  /** When null/falsey and back is not loading, back face shows `backPlaceholder`. */
  backSrc: string | null;
  backLoading?: boolean;
  altFront: string;
  altBack: string;
  backPlaceholder: ReactNode;
  angleDeg: number;
  onAngleChange: (deg: number) => void;
  /** Smooth 0°↔180° oscillation (honours reduced motion off). */
  autoSweepEnabled?: boolean;
  /** Fired once when a horizontal drag takes over — stop autoplay externally if needed. */
  onAutoSweepUserGesture?: () => void;
  className?: string;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function snapAngleToFace(angleDeg: number): 0 | 180 {
  return angleDeg >= 90 ? 180 : 0;
}

export function SlabCardFlip({
  frontSrc,
  backSrc,
  backLoading = false,
  altFront,
  altBack,
  backPlaceholder,
  angleDeg,
  onAngleChange,
  autoSweepEnabled = false,
  onAutoSweepUserGesture,
  className = "",
}: SlabCardFlipProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const pendingAngleRef = useRef(angleDeg);
  pendingAngleRef.current = angleDeg;
  const onAngleChangeRef = useRef(onAngleChange);
  onAngleChangeRef.current = onAngleChange;
  const [preferReducedMotion, setPreferReducedMotion] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const gestureRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startAngle: number;
    decided: boolean;
    active: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setPreferReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const endDrag = useCallback(() => {
    gestureRef.current = null;
    setDragActive(false);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const g = gestureRef.current;
      if (!g || e.pointerId !== g.pointerId) return;

      const dx = e.clientX - g.originX;
      const dy = e.clientY - g.originY;

      if (!g.decided) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx < 10 && absDy < 10) return;
        g.decided = true;
        if (absDx <= absDy) {
          endDrag();
          try {
            e.currentTarget.releasePointerCapture?.(g.pointerId);
          } catch {
            /* noop */
          }
          return;
        }
        g.active = true;
        setDragActive(true);
        onAutoSweepUserGesture?.();
        try {
          e.currentTarget.setPointerCapture(g.pointerId);
        } catch {
          /* noop */
        }
      }

      if (!g.active || !sceneRef.current) return;
      const w = sceneRef.current.getBoundingClientRect().width || 280;
      const deltaDeg = (dx / Math.max(w, 1)) * 130;
      const next = clamp(g.startAngle + deltaDeg, 0, 180);
      pendingAngleRef.current = next;
      onAngleChange(next);
    },
    [endDrag, onAngleChange, onAutoSweepUserGesture],
  );

  const handlePointerUpLike = useCallback(
    (e: React.PointerEvent) => {
      const g = gestureRef.current;
      if (!g || e.pointerId !== g.pointerId) return;
      if (g.active) {
        onAngleChange(snapAngleToFace(pendingAngleRef.current));
      }
      try {
        if (g.active) {
          e.currentTarget.releasePointerCapture?.(g.pointerId);
        }
      } catch {
        /* noop */
      }
      endDrag();
    },
    [endDrag, onAngleChange],
  );

  const backReady = Boolean(backSrc);
  const autoSweepOk =
    autoSweepEnabled && !preferReducedMotion && backReady && !backLoading && !dragActive;

  useEffect(() => {
    if (!autoSweepOk) return;
    let cancelled = false;
    let raf = 0;
    const periodMs = 9000;
    const t0 = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = ((now - t0) % periodMs) / periodMs;
      const phase = elapsed * Math.PI * 2;
      const angle = ((1 - Math.cos(phase)) / 2) * 180;
      onAngleChangeRef.current(angle);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [autoSweepOk]);

  const sweepMotion =
    autoSweepEnabled && !preferReducedMotion && backReady && !backLoading && !dragActive;
  const flipTransitionStyle =
    dragActive || sweepMotion ? "none" : preferReducedMotion ? FLIP_EASE_REDUCED_MS : FLIP_EASE_MS;

  const backContent =
    backLoading || !backReady ? (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#080c12] px-4 text-center">
        {backLoading ? (
          <div className="h-full w-full animate-pulse bg-gray-900/75" aria-hidden />
        ) : (
          backPlaceholder
        )}
      </div>
    ) : (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backSrc!}
          alt={altBack}
          className="h-full w-full object-contain object-center select-none bg-[#030508]"
          draggable={false}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </>
    );

  return (
    <div
      ref={sceneRef}
      className={`relative h-full min-h-0 w-full select-none outline-none touch-pan-y [perspective:min(1320px,110vw)] ${className}`}
      aria-label="Slab front and back"
      onPointerCancel={handlePointerUpLike}
    >
      <div
        className="relative h-full w-full rounded-xl"
        role="presentation"
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          gestureRef.current = {
            pointerId: e.pointerId,
            originX: e.clientX,
            originY: e.clientY,
            startAngle: angleDeg,
            decided: false,
            active: false,
          };
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpLike}
        onLostPointerCapture={endDrag}
        style={{
          cursor: dragActive ? "grabbing" : "grab",
        }}
      >
        <div
          className="relative h-full w-full rounded-xl"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${angleDeg}deg)`,
            transition: flipTransitionStyle,
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 overflow-hidden rounded-xl bg-[#030508]"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "translateZ(0.5px)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frontSrc}
              alt={altFront}
              className="h-full w-full object-contain object-center select-none"
              draggable={false}
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 overflow-hidden rounded-xl bg-[#030508]"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg) translateZ(0.5px)",
            }}
          >
            {backContent}
          </div>
        </div>
      </div>
    </div>
  );
}
