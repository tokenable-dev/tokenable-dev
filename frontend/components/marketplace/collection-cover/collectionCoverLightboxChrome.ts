/**
 * Shared layout tokens for collection cover lightboxes (simple + swipe).
 * Max slab: 390×780px (3:4), capped by 90vw / 82vh on small screens.
 */

/** Uniform enlarged frame — same max slab, shrinks when viewport is tight. */
export const COLLECTION_COVER_LIGHTBOX_FRAME_CLASS =
  "relative mx-auto flex shrink-0 items-center justify-center overflow-hidden bg-black " +
  "aspect-[3/4] " +
  "w-[min(90vw,390px,calc(min(82vh,780px)*3/4))] " +
  "max-h-[min(82vh,780px)]";

export const COLLECTION_COVER_LIGHTBOX_BACKDROP_CLASS =
  "fixed inset-0 z-[100] flex touch-none select-none overscroll-none bg-black/88 backdrop-blur-[2px]";

export const COLLECTION_COVER_LIGHTBOX_IMAGE_STAGE_CLASS =
  "flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8";

/** Reserved bottom slot so image vertical position stays stable when swipe hint is hidden. */
export const COLLECTION_COVER_LIGHTBOX_SWIPE_FOOTER_CLASS =
  "pointer-events-none flex shrink-0 justify-center pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] min-h-[2.75rem]";
