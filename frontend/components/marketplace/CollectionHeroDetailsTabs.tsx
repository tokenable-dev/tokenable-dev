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
    <div className="w-full min-w-0">
      <div
        className="flex w-full gap-1 min-[375px]:gap-0"
        role="tablist"
        aria-label="Collection information"
      >
        <div
          role="tab"
          aria-selected
          className="relative flex min-h-[44px] min-w-0 flex-1 items-center justify-center px-2 pb-3 pt-2 text-center text-[14px] font-semibold tracking-tight text-white sm:min-h-0 sm:px-1 sm:pt-1 sm:text-[15px]"
        >
          Details
          <span
            className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-[1px] bg-white min-[375px]:left-0 min-[375px]:right-0"
            aria-hidden
          />
        </div>
        <button
          type="button"
          role="tab"
          aria-selected={false}
          onClick={() => onAiInsightsClick?.()}
          className="relative flex min-h-[44px] min-w-0 flex-1 items-center justify-center px-2 pb-3 pt-2 text-center text-[14px] font-semibold tracking-tight text-[#a0a0a0] transition-colors hover:text-zinc-200 sm:min-h-0 sm:px-1 sm:pt-1 sm:text-[15px] active:bg-white/[0.04]"
        >
          AI Insights
        </button>
      </div>
      <div className="h-px w-full bg-white/[0.09]" aria-hidden />

      <div className="mt-3 min-w-0 sm:mt-4" role="tabpanel" aria-label="Details">
        {detailsPanel}
      </div>
    </div>
  );
}
