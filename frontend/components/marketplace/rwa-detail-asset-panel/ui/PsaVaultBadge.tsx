"use client";

import {
  RWA_DETAIL_OUTLINE_TAG_DESKTOP,
  RWA_DETAIL_OUTLINE_TAG_MOBILE,
} from "../theme/constants";

/** Outline tag — PSA Vault (text only, matches other headline tags). */
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
    <span className={`${tagClass} ${className}`.trim()} aria-label="PSA Vault">
      PSA Vault
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
      ? "h-[20px] w-[4.75rem] border-zinc-800"
      : "h-[26px] w-[5.25rem] border-zinc-800";

  return (
    <span
      className={`inline-flex shrink-0 animate-pulse rounded border bg-zinc-800/80 ${sizeClass}`}
      aria-hidden
    />
  );
}
