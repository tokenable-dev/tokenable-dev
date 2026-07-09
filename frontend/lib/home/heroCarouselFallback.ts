import { ASSETS } from "@/constants/assets";
import { isMobileHeroViewport } from "@/lib/home/heroCarouselCapability";

export type HeroCarouselFallbackController = {
  dispose: () => void;
};

/**
 * Static hero slab — same slot as WebGL host; no Three.js on mobile / reduced-motion / WebGL fail.
 */
export function setupHeroCarouselFallback(input: {
  host: HTMLElement;
  heroSection: HTMLElement;
  mobileSlot: HTMLElement | null;
}): HeroCarouselFallbackController {
  const { host, heroSection, mobileSlot } = input;
  const mobile = isMobileHeroViewport();

  if (mobile && mobileSlot) {
    mobileSlot.appendChild(host);
    host.style.position = "relative";
    host.style.inset = "auto";
    host.style.width = "100%";
    host.style.height = "100%";
  } else {
    heroSection.insertBefore(host, heroSection.firstChild);
    host.style.position = "absolute";
    host.style.inset = "0";
    host.style.width = "";
    host.style.height = "";
  }

  const frame = document.createElement("div");
  frame.className = mobile
    ? "home-hero__fallback home-hero__fallback--mobile"
    : "home-hero__fallback";
  frame.setAttribute("aria-hidden", "true");

  const img = document.createElement("img");
  img.className = "home-hero__fallback-img";
  img.src = ASSETS.ds.heroSlab;
  img.alt = "";
  img.decoding = "async";
  img.loading = "eager";
  img.draggable = false;

  frame.appendChild(img);
  host.insertBefore(frame, host.firstChild);

  return {
    dispose: () => {
      frame.remove();
    },
  };
}
