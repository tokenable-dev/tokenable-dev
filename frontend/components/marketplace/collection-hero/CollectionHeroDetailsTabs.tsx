"use client";

import { type ReactNode } from "react";
import { orderBookTabLabelCls } from "@/components/marketplace/price-metrics-strip/theme";

const MOBILE_TAB_CLASS =
  "relative flex min-h-[24px] min-w-0 flex-1 items-center justify-center px-1 pb-1 pt-0.5 text-center text-[10px] font-semibold tracking-tight sm:min-h-0 sm:px-1 sm:pb-1.5 sm:pt-0.5 sm:text-[14px]";

const DESKTOP_TAB_BASE = `${orderBookTabLabelCls} relative flex min-w-0 flex-1 items-center justify-center border-b-2 border-transparent pb-2 pt-1 text-center transition-colors max-lg:hidden`;

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
        className="flex w-full min-w-0 gap-1 min-[375px]:gap-0 lg:gap-3 lg:border-b lg:border-zinc-800/70"
        role="tablist"
        aria-label="Collection information"
      >
        <div
          role="tab"
          aria-selected
          className={`${MOBILE_TAB_CLASS} text-white lg:hidden`}
        >
          Details
          <span
            className="absolute bottom-0 left-1.5 right-1.5 h-[2px] rounded-t-[1px] bg-white min-[375px]:left-0 min-[375px]:right-0 lg:hidden"
            aria-hidden
          />
        </div>
        <div
          role="tab"
          aria-selected
          className={`${DESKTOP_TAB_BASE} border-white font-semibold text-white`}
        >
          Details
        </div>
        <button
          type="button"
          role="tab"
          aria-selected={false}
          onClick={() => onAiInsightsClick?.()}
          className={`${MOBILE_TAB_CLASS} text-[#a0a0a0] transition-colors hover:text-zinc-200 active:bg-white/[0.04] lg:hidden`}
        >
          AI Insights
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={false}
          onClick={() => onAiInsightsClick?.()}
          className={`${DESKTOP_TAB_BASE} font-medium text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300`}
        >
          AI Insights
        </button>
      </div>
      <div className="mt-1 w-full min-w-0 max-lg:mt-1 lg:mt-2" role="tabpanel" aria-label="Details">
        {detailsPanel}
      </div>
    </div>
  );
}
