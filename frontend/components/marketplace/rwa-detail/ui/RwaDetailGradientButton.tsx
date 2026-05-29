"use client";

import type { ReactNode } from "react";
import {
  GradientOutlineFrame,
  PRODUCT_OUTLINE_PAD_CLASS,
  gradientOutlineInnerButtonClass,
} from "@/components/ui/GradientOutlineFrame";
import { rwaDetailRightFont } from "../theme";

export function RwaDetailGradientButton({
  children,
  onClick,
  disabled,
  className = "",
  bright = false,
  compact = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  bright?: boolean;
  compact?: boolean;
}) {
  const frameShadow = bright
    ? "shadow-[0_10px_28px_-10px_rgba(0,0,0,0.75),0_0_40px_-4px_rgba(16,211,51,0.48)] has-[:enabled]:hover:shadow-[0_12px_32px_-10px_rgba(0,0,0,0.82),0_0_52px_-2px_rgba(16,211,51,0.62)] has-[:enabled]:focus-within:shadow-[0_12px_32px_-10px_rgba(0,0,0,0.82),0_0_52px_-2px_rgba(16,211,51,0.62)]"
    : "shadow-[0_8px_24px_-10px_rgba(0,0,0,0.75),0_0_24px_-8px_rgba(16,211,51,0.32)] has-[:enabled]:hover:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.8),0_0_36px_-6px_rgba(16,211,51,0.5)] has-[:enabled]:focus-within:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.8),0_0_36px_-6px_rgba(16,211,51,0.5)]";

  return (
    <GradientOutlineFrame
      className={`group/cta w-full min-w-0 max-w-full transition-shadow duration-200 ease-out ${frameShadow} ${className}`}
      roundedClass="rounded-full"
      padClass={PRODUCT_OUTLINE_PAD_CLASS}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${rwaDetailRightFont.className} ${gradientOutlineInnerButtonClass} flex w-full items-center justify-center !rounded-full border-0 leading-none tracking-normal outline-none transition-[background-color,box-shadow,filter] duration-200 ease-out enabled:hover:bg-zinc-950 enabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(16,211,51,0.08)] enabled:hover:brightness-110 enabled:hover:saturate-110 enabled:focus-visible:ring-2 enabled:focus-visible:ring-mint/50 enabled:focus-visible:ring-offset-2 enabled:focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:!bg-black disabled:text-mint/35 motion-reduce:enabled:hover:brightness-100 ${
          compact
            ? "min-h-[48px] px-4 text-[15px] sm:min-h-[52px] sm:text-base"
            : "min-h-[50px] px-6 text-[18px] sm:min-h-[58px] sm:px-10 sm:text-[20px]"
        }`}
        style={{ backgroundColor: "#000000" }}
      >
        {children}
      </button>
    </GradientOutlineFrame>
  );
}
