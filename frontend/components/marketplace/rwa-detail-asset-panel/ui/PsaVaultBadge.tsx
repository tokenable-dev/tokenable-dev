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
