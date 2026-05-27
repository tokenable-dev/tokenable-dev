"use client";

import { type CSSProperties, type ReactNode } from "react";

/** Product-wide 5px CTA rim — matches design spec (border-image gradient). */
export const PRODUCT_OUTLINE_GRADIENT =
  "linear-gradient(99.84deg, #00644D 13.74%, #10D333 42.04%, #09705B 78.78%)";

/** Tailwind padding equivalent to `border: 5px solid` on the gradient frame. */
export const PRODUCT_OUTLINE_PAD_CLASS = "p-[5px]";

/** Vault UI — thinner rim so stepper/tabs/upload do not feel heavy. */
export const VAULT_OUTLINE_PAD_CLASS = "p-px";

export function GradientOutlineFrame({
  children,
  className = "",
  roundedClass = "rounded-xl",
  padClass = PRODUCT_OUTLINE_PAD_CLASS,
  style,
}: {
  children: ReactNode;
  className?: string;
  roundedClass?: string;
  padClass?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={[roundedClass, padClass, className].filter(Boolean).join(" ")}
      style={{ background: PRODUCT_OUTLINE_GRADIENT, ...style }}
    >
      {children}
    </div>
  );
}

/** Inner fill for gradient-outline buttons (Connect wallet, Upload photo, etc.). */
export const gradientOutlineInnerButtonClass =
  "w-full rounded-[7px] !bg-black font-bold text-mint transition disabled:cursor-not-allowed disabled:!bg-black disabled:text-mint/35";
