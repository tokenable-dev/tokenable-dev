"use client";

import type { ReactNode } from "react";
import { TkButton } from "@/components/ds";
import { cn } from "@/lib/ds/cn";
import { RWA_DETAIL_CTA_HEIGHT_CLASS } from "../theme";

/** Secondary CTA — pairs with primary Buy now / List actions. */
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
  return (
    <TkButton
      type="button"
      variant="neutral"
      disabled={disabled}
      onClick={onClick}
      className={cn("w-full justify-center", RWA_DETAIL_CTA_HEIGHT_CLASS, className)}
    >
      {children}
    </TkButton>
  );
}
