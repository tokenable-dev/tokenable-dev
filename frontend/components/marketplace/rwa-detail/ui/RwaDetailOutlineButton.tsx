"use client";

import type { ReactNode } from "react";
import {
  GradientOutlineFrame,
  PLACE_BID_OUTLINE_GRADIENT,
} from "@/components/ui/GradientOutlineFrame";
import {
  rwaDetailRightFont,
  RWA_DETAIL_MOBILE_CTA_FRAME_ROUNDED,
  RWA_DETAIL_MOBILE_CTA_INNER_ROUNDED,
  RWA_DETAIL_MOBILE_CTA_RIM_PAD_CLASS,
  RWA_DETAIL_PLACE_BID_FRAME_SHADOW,
} from "../theme";

/** Secondary CTA — metallic silver gradient rim (Buy now / Place bid pair). */
export function RwaDetailOutlineButton({
  children,
  onClick,
  disabled,
  className = "",
  compact = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const buttonClass = `${rwaDetailRightFont.className} w-full border-0 bg-black font-bold leading-none tracking-normal text-white outline-none transition-[background-color] duration-200 ease-out enabled:hover:bg-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-500 ${
    compact
      ? "min-h-[48px] px-4 text-[15px] sm:min-h-[52px] sm:text-base"
      : "min-h-[50px] px-6 text-[18px] sm:min-h-[58px] sm:px-10 sm:text-[20px]"
  }`;

  return (
    <GradientOutlineFrame
      className={`group/cta-secondary w-full min-w-0 transition-shadow duration-200 ease-out ${RWA_DETAIL_PLACE_BID_FRAME_SHADOW} ${className}`.trim()}
      roundedClass={RWA_DETAIL_MOBILE_CTA_FRAME_ROUNDED}
      padClass={RWA_DETAIL_MOBILE_CTA_RIM_PAD_CLASS}
      style={{ background: PLACE_BID_OUTLINE_GRADIENT }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${buttonClass} ${RWA_DETAIL_MOBILE_CTA_INNER_ROUNDED}`}
        style={{ backgroundColor: "#000000" }}
      >
        {children}
      </button>
    </GradientOutlineFrame>
  );
}
