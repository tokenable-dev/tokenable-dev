"use client";

import type { ReactNode } from "react";
import {
  rwaDetailRightFont,
  RWA_DETAIL_BUTTON_FRAME_ROUNDED,
  RWA_DETAIL_BUTTON_INNER_ROUNDED,
  RWA_DETAIL_BUTTON_RIM_PAD_CLASS,
} from "../theme";

/** Secondary CTA — 2px #526974 rim (e.g. Place bid beside Buy now). */
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
  return (
    <div
      className={`group/cta-secondary w-full min-w-0 ${RWA_DETAIL_BUTTON_FRAME_ROUNDED} ${RWA_DETAIL_BUTTON_RIM_PAD_CLASS} bg-[#526974] transition-colors duration-200 has-[:enabled]:hover:bg-[#5a7380] has-[:disabled]:bg-[#526974]/45 ${className}`.trim()}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${rwaDetailRightFont.className} w-full ${RWA_DETAIL_BUTTON_INNER_ROUNDED} border-0 bg-black font-bold leading-none tracking-normal text-white outline-none transition-[background-color] duration-200 ease-out enabled:hover:bg-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-500 ${
          compact
            ? "min-h-[48px] px-4 text-[15px] sm:min-h-[52px] sm:text-base"
            : "min-h-[50px] px-6 text-[18px] sm:min-h-[58px] sm:px-10 sm:text-[20px]"
        }`}
        style={{ backgroundColor: "#000000" }}
      >
        {children}
      </button>
    </div>
  );
}
