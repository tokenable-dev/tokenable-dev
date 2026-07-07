"use client";

import { useEffect } from "react";
import { createHeroSlabCarousel } from "@/lib/home/heroSlabCarousel";

type HomeHeroSlabCarouselProps = {
  heroRef: React.RefObject<HTMLElement | null>;
  mobileSlotRef: React.RefObject<HTMLElement | null>;
};

const MOBILE_MQ = "(max-width: 767px)";

/** WebGL graded-card ring behind the home hero (index.html `hero-slab-3d.js`). */
export function HomeHeroSlabCarousel({
  heroRef,
  mobileSlotRef,
}: HomeHeroSlabCarouselProps) {
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const host = document.createElement("div");
    host.className = "home-hero__canvas-host";
    host.setAttribute("aria-hidden", "true");
    hero.insertBefore(host, hero.firstChild);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobileQuery = window.matchMedia(MOBILE_MQ);

    let controller: ReturnType<typeof createHeroSlabCarousel> = null;
    let resizeObserver: ResizeObserver | null = null;
    let cancelled = false;

    const tryInit = () => {
      if (cancelled || controller) return;

      const mobileSlot = mobileSlotRef.current;
      if (mobileQuery.matches && !mobileSlot) return;

      controller = createHeroSlabCarousel({
        host,
        heroSection: hero,
        mobileSlot,
        prefersReducedMotion,
      });

      if (controller) {
        resizeObserver?.disconnect();
        resizeObserver = null;
      }
    };

    const scheduleTryInit = () => {
      requestAnimationFrame(() => {
        if (!cancelled) tryInit();
      });
    };

    scheduleTryInit();

    resizeObserver = new ResizeObserver(() => scheduleTryInit());
    resizeObserver.observe(hero);
    resizeObserver.observe(host);
    const mobileSlot = mobileSlotRef.current;
    if (mobileSlot) resizeObserver.observe(mobileSlot);

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      controller?.dispose();
      host.remove();
    };
  }, [heroRef, mobileSlotRef]);

  return null;
}
