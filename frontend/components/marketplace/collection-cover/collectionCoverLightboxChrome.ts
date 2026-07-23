/**
 * Shared layout tokens for collection cover lightboxes (simple + swipe).
 * Near-viewport 3:4 slab — uses dvh so iOS toolbars / safe-area don't clip.
 */

/** Uniform enlarged frame — large on desktop, safe on mobile (room for swipe footer). */
export const COLLECTION_COVER_LIGHTBOX_FRAME_CLASS =
  "relative mx-auto flex shrink-0 items-center justify-center overflow-hidden bg-black " +
  "aspect-[3/4] " +
  "w-[min(92vw,calc(min(85dvh,92vh,1000px)*3/4))] " +
  "max-h-[min(85dvh,92vh,1000px)] " +
  "shadow-[0_28px_80px_-24px_rgba(0,0,0,0.85)]";

export const COLLECTION_COVER_LIGHTBOX_BACKDROP_CLASS =
  "fixed inset-0 z-[100] flex touch-none select-none overscroll-none bg-black/90 backdrop-blur-[2px] " +
  "pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]";

export const COLLECTION_COVER_LIGHTBOX_IMAGE_STAGE_CLASS =
  "flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-6";

/** Reserved bottom slot so image vertical position stays stable when swipe hint is hidden. */
export const COLLECTION_COVER_LIGHTBOX_SWIPE_FOOTER_CLASS =
  "pointer-events-none flex shrink-0 justify-center pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] min-h-[2.5rem]";
