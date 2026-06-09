"use client";

import { type ReactNode } from "react";

export function CollectionHeroDetailsTabs({
  detailsPanel,
  onAiInsightsClick,
}: {
  detailsPanel: ReactNode;
  /** Opens “coming soon” / off-service UI — does not switch away from the details panel. */
  onAiInsightsClick?: () => void;
}) {
  return (
    <div className="w-full min-w-0 max-w-full">
      <div
        className="flex w-full min-w-0 gap-1 min-[375px]:gap-0"
        role="tablist"
        aria-label="Collection information"
      >
        <div
          role="tab"
          aria-selected
          className="relative flex min-h-[32px] min-w-0 flex-1 items-center justify-center px-2 pb-1.5 pt-1 text-center text-[13px] font-semibold tracking-tight text-white max-lg:min-h-[24px] max-lg:px-1 max-lg:pb-1 max-lg:pt-0.5 max-lg:text-[10px] sm:min-h-0 sm:px-1 sm:pb-1.5 sm:pt-0.5 sm:text-[14px]"
        >
          Details
          <span
            className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-[1px] bg-white max-lg:left-1.5 max-lg:right-1.5 max-lg:h-[2px] min-[375px]:left-0 min-[375px]:right-0"
            aria-hidden
          />
        </div>
        <button
          type="button"
          role="tab"
          aria-selected={false}
          onClick={() => onAiInsightsClick?.()}
          className="relative flex min-h-[32px] min-w-0 flex-1 items-center justify-center px-2 pb-1.5 pt-1 text-center text-[13px] font-semibold tracking-tight text-[#a0a0a0] transition-colors hover:text-zinc-200 max-lg:min-h-[24px] max-lg:px-1 max-lg:pb-1 max-lg:pt-0.5 max-lg:text-[10px] sm:min-h-0 sm:px-1 sm:pb-1.5 sm:pt-0.5 sm:text-[14px] active:bg-white/[0.04]"
        >
          AI Insights
        </button>
      </div>
      <div className="mt-1 w-full min-w-0 max-lg:mt-1" role="tabpanel" aria-label="Details">
        {detailsPanel}
      </div>
    </div>
  );
}
