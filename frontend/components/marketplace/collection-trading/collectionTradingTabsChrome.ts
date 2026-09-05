import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";

export function collectionTradingSectionClassName(input: {
  docked: boolean;
  dockVisible: boolean;
  flush: boolean;
}): string {
  const { docked, dockVisible, flush } = input;
  if (docked) {
    return [
      "box-border flex max-h-[min(560px,88dvh)] min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden",
      "fixed bottom-0 left-0 right-0 z-[100] sm:bottom-5 sm:left-auto sm:right-5 sm:w-[min(100vw-2.5rem,420px)]",
      "rounded-t-2xl border border-black bg-black shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)] ring-1 ring-black sm:rounded-xl",
      "transition-[transform,opacity,visibility] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
      dockVisible
        ? "translate-y-0 opacity-100 visible"
        : "pointer-events-none invisible translate-y-[105%] opacity-0",
    ].join(" ");
  }
  if (flush) {
    return "box-border flex h-full max-h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none ring-0";
  }
  return `min-w-0 w-full max-w-full overflow-hidden rounded-xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)] ring-1 ring-black`;
}
