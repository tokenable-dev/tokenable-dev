"use client";

import type { MouseEventHandler, ReactNode } from "react";
import { TkButton } from "@/components/ds";
import { cn } from "@/lib/ds/cn";
import { RWA_DETAIL_CTA_HEIGHT_CLASS } from "../theme";

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
  return (
    <TkButton
      type="button"
      variant="primary"
      disabled={disabled}
      onClick={onClick}
      className={cn("w-full justify-center", RWA_DETAIL_CTA_HEIGHT_CLASS, className)}
    >
      {children}
    </TkButton>
  );
}
