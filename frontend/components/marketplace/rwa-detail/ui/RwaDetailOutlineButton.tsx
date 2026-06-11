"use client";

import type { ReactNode } from "react";
import {
  GradientOutlineFrame,
  PLACE_BID_OUTLINE_GRADIENT,
} from "@/components/ui/GradientOutlineFrame";
import {
  rwaDetailRightFont,
  RWA_DETAIL_CTA_HEIGHT_CLASS,
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
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const buttonClass = `${rwaDetailRightFont.className} ${RWA_DETAIL_CTA_HEIGHT_CLASS} w-full border-0 bg-black px-4 text-[14px] font-bold leading-none tracking-normal text-white outline-none transition-[background-color] duration-200 ease-out enabled:hover:bg-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-500 sm:px-5 sm:text-[15px]`;

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
