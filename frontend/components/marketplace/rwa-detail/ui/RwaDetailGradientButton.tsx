"use client";

import type { MouseEventHandler, ReactNode } from "react";
import {
  BUY_NOW_OUTLINE_GRADIENT,
  GradientOutlineFrame,
  gradientOutlineInnerButtonClass,
} from "@/components/ui/GradientOutlineFrame";
import {
  rwaDetailRightFont,
  RWA_DETAIL_BUY_NOW_FRAME_SHADOW,
  RWA_DETAIL_BUY_NOW_TEXT_CLASS,
  RWA_DETAIL_CTA_HEIGHT_CLASS,
  RWA_DETAIL_MOBILE_CTA_FRAME_ROUNDED,
  RWA_DETAIL_MOBILE_CTA_INNER_ROUNDED,
  RWA_DETAIL_MOBILE_CTA_RIM_PAD_CLASS,
} from "../theme";

export function RwaDetailGradientButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
}) {
  const rimPadClass = RWA_DETAIL_MOBILE_CTA_RIM_PAD_CLASS;
  const innerRoundedClass = RWA_DETAIL_MOBILE_CTA_INNER_ROUNDED;

  return (
    <GradientOutlineFrame
      className={`group/cta w-full min-w-0 max-w-full transition-shadow duration-200 ease-out ${RWA_DETAIL_BUY_NOW_FRAME_SHADOW} ${className}`}
      roundedClass={RWA_DETAIL_MOBILE_CTA_FRAME_ROUNDED}
      padClass={rimPadClass}
      style={{ background: BUY_NOW_OUTLINE_GRADIENT }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${rwaDetailRightFont.className} ${gradientOutlineInnerButtonClass} ${RWA_DETAIL_CTA_HEIGHT_CLASS} flex w-full items-center justify-center ${innerRoundedClass} border-0 px-4 text-[14px] font-bold leading-none tracking-normal outline-none transition-[background-color,box-shadow,filter] duration-200 ease-out enabled:hover:bg-zinc-950 enabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(16,211,51,0.08)] enabled:hover:brightness-110 enabled:hover:saturate-110 disabled:cursor-not-allowed disabled:!bg-black disabled:text-mint/35 motion-reduce:enabled:hover:brightness-100 sm:px-5 sm:text-[15px] ${RWA_DETAIL_BUY_NOW_TEXT_CLASS}`}
        style={{ backgroundColor: "#000000" }}
      >
        {children}
      </button>
    </GradientOutlineFrame>
  );
}
