"use client";

import { useEffect } from "react";
import {
  detectHeroCarouselTier,
  type HeroCarouselTier,
} from "@/lib/home/heroCarouselCapability";
import { setupHeroCarouselFallback } from "@/lib/home/heroCarouselFallback";
import { preloadHeroCarouselImages } from "@/lib/home/heroCarouselPreload";
import { useHeroCarouselImageSources } from "@/hooks/home/useHeroCarouselImageSources";
import type { HeroSlabCarouselController } from "@/lib/home/heroSlabCarousel";

type HomeHeroSlabCarouselProps = {
  heroRef: React.RefObject<HTMLElement | null>;
  mobileSlotRef: React.RefObject<HTMLElement | null>;
};

const MOBILE_MQ = "(max-width: 767px)";
const INIT_TIMEOUT_MS = 10_000;
const MOBILE_SLOT_WAIT_MS = 2_000;

async function waitForMobileSlot(
  slot: HTMLElement | null,
  maxMs = MOBILE_SLOT_WAIT_MS,
): Promise<boolean> {
  if (!slot) return false;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (slot.clientWidth > 0 && slot.clientHeight > 0) return true;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return slot.clientWidth > 0 && slot.clientHeight > 0;
}

type ActiveController =
  | { kind: "webgl"; ctrl: HeroSlabCarouselController }
  | { kind: "fallback"; ctrl: { dispose: () => void } };

/** WebGL graded-card ring behind the home hero (index.html `hero-slab-3d.js`). */
export function HomeHeroSlabCarousel({
  heroRef,
  mobileSlotRef,
}: HomeHeroSlabCarouselProps) {
  const { data: imageSources = [], isPending: imagesPending } =
    useHeroCarouselImageSources();

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || imagesPending) return;

    const host = document.createElement("div");
    host.className = "home-hero__canvas-host";
    host.setAttribute("aria-hidden", "true");

    const overlay = document.createElement("div");
    overlay.className = "home-hero__overlay";
    overlay.setAttribute("aria-hidden", "true");
    host.appendChild(overlay);

    hero.insertBefore(host, hero.firstChild);

    const mobileQuery = window.matchMedia(MOBILE_MQ);
    let active: ActiveController | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let cancelled = false;
    let initGeneration = 0;
    const fallbackSrc = imageSources[0] ?? null;

    const disposeActive = () => {
      active?.ctrl.dispose();
      active = null;
    };

    const mountFallback = (src: string | null = fallbackSrc) => {
      disposeActive();
      const frame = host.querySelector(".home-hero__fallback");
      if (!frame) {
        active = {
          kind: "fallback",
          ctrl: setupHeroCarouselFallback({
            host,
            heroSection: hero,
            mobileSlot: mobileSlotRef.current,
            imageSrc: src,
          }),
        };
      }
    };

    const pauseIfHidden = () => {
      if (active?.kind !== "webgl") return;
      const visible = document.visibilityState === "visible";
      if (visible) active.ctrl.resume();
      else active.ctrl.pause();
    };

    const boot = async (tier: HeroCarouselTier) => {
      const gen = ++initGeneration;
      disposeActive();
      host.querySelector(".home-hero__fallback")?.remove();

      if (tier === "fallback" || imageSources.length === 0) {
        mountFallback(imageSources[0] ?? null);
        return;
      }

      if (mobileQuery.matches) {
        const slotReady = await waitForMobileSlot(mobileSlotRef.current);
        if (!slotReady) return;
      }

      const loadModule = import("@/lib/home/heroSlabCarousel");

      let aborted = false;
      const timeoutId = window.setTimeout(() => {
        aborted = true;
      }, INIT_TIMEOUT_MS);

      try {
        const loadedSources = await preloadHeroCarouselImages(tier, imageSources);
        if (cancelled || gen !== initGeneration || aborted) {
          if (aborted) mountFallback(loadedSources[0] ?? fallbackSrc);
          return;
        }

        if (loadedSources.length === 0) {
          // No decodeable covers — hide the ring rather than Tokenable placeholder faces.
          return;
        }

        const { createHeroSlabCarousel } = await loadModule;
        if (cancelled || gen !== initGeneration || aborted) {
          if (aborted) mountFallback(loadedSources[0] ?? fallbackSrc);
          return;
        }

        const ctrl = createHeroSlabCarousel({
          host,
          heroSection: hero,
          mobileSlot: mobileSlotRef.current,
          tier,
          imageSources: loadedSources,
        });

        if (cancelled || gen !== initGeneration) {
          ctrl?.dispose();
          return;
        }

        if (!ctrl) {
          if (mobileQuery.matches) return;
          mountFallback(loadedSources[0] ?? fallbackSrc);
          return;
        }

        active = { kind: "webgl", ctrl };
        pauseIfHidden();
      } catch {
        if (!cancelled && gen === initGeneration) mountFallback();
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    const resolveTier = (): HeroCarouselTier => detectHeroCarouselTier();

    const run = () => {
      void boot(resolveTier());
    };

    const scheduleRun = () => {
      requestAnimationFrame(() => {
        if (!cancelled) run();
      });
    };

    scheduleRun();

    const intersection = new IntersectionObserver(
      (entries) => {
        if (active?.kind !== "webgl") return;
        const visible = entries.some((e) => e.isIntersecting);
        if (visible) active.ctrl.resume();
        else active.ctrl.pause();
      },
      { root: null, threshold: 0 },
    );
    intersection.observe(hero);

    const onVisibility = () => pauseIfHidden();
    document.addEventListener("visibilitychange", onVisibility);

    const onMobileChange = () => {
      scheduleRun();
    };
    mobileQuery.addEventListener("change", onMobileChange);

    resizeObserver = new ResizeObserver(() => {
      if (mobileQuery.matches && active?.kind === "webgl") {
        scheduleRun();
        return;
      }
      if (!active && host.isConnected) scheduleRun();
    });
    resizeObserver.observe(hero);
    resizeObserver.observe(host);
    const mobileSlot = mobileSlotRef.current;
    if (mobileSlot) resizeObserver.observe(mobileSlot);

    return () => {
      cancelled = true;
      initGeneration += 1;
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      mobileQuery.removeEventListener("change", onMobileChange);
      resizeObserver?.disconnect();
      disposeActive();
      host.remove();
    };
  }, [heroRef, mobileSlotRef, imageSources, imagesPending]);

  return null;
}
