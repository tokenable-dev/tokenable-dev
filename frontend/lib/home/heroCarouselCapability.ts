/** Hero 3D carousel quality tier — performance only; layout/visual tokens unchanged per tier target device class. */

export type HeroCarouselTier = "full" | "reduced" | "fallback";

const MOBILE_MQ = "(max-width: 768px)";

export function isMobileHeroViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_MQ).matches;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Heuristic for Intel UHD-class GPUs and low core/memory devices. */
export function isLowEndDesktop(): boolean {
  if (typeof navigator === "undefined") return false;

  const cores = navigator.hardwareConcurrency ?? 8;
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (cores <= 4 && memory <= 4) return true;

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return false;
    const renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    if (/swiftshader|llvmpipe|basic render/i.test(renderer)) return true;
    if (/intel/i.test(renderer) && /(hd|uhd)\s*(graphics|630|620|530|515)?/i.test(renderer)) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

export function detectHeroCarouselTier(): HeroCarouselTier {
  if (prefersReducedMotion()) return "fallback";
  if (!hasWebGL()) return "fallback";
  if (isLowEndDesktop()) return "reduced";
  return "full";
}

export function cardCountForTier(tier: HeroCarouselTier): number {
  if (tier === "reduced") return 6;
  if (tier === "full") return 10;
  return 0;
}
