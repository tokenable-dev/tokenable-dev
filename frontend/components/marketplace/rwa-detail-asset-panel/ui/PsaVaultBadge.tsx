"use client";

import { PsaVaultLeadingIcon } from "./PsaVaultLeadingMark";
import {
  RWA_DETAIL_OUTLINE_TAG_DESKTOP,
  RWA_DETAIL_OUTLINE_TAG_MOBILE,
} from "../theme/constants";

/** Outline tag — vault icon + PSA (text) + Vault. */
export function PsaVaultOutlineTag({
  variant = "desktop",
  className = "",
}: {
  variant?: "desktop" | "mobile";
  className?: string;
}) {
  const tagClass =
    variant === "mobile" ? RWA_DETAIL_OUTLINE_TAG_MOBILE : RWA_DETAIL_OUTLINE_TAG_DESKTOP;

  return (
    <span className={`${tagClass} gap-1 ${className}`.trim()} aria-label="PSA Vault">
      <PsaVaultLeadingIcon />
      <span className="leading-none">
        <span className="font-bold">PSA</span>
        <span className="font-normal"> Vault</span>
      </span>
    </span>
  );
}

export function PsaVaultOutlineTagSkeleton({
  variant = "desktop",
}: {
  variant?: "desktop" | "mobile";
}) {
  const sizeClass =
    variant === "mobile"
      ? "h-[20px] w-[5.75rem] border-zinc-800"
      : "h-[26px] w-[6.5rem] border-zinc-800";

  return (
    <span
      className={`inline-flex shrink-0 animate-pulse rounded border bg-zinc-800/80 ${sizeClass}`}
      aria-hidden
    />
  );
}
