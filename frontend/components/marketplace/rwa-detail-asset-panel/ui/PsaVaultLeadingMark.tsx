"use client";

import Image from "next/image";
import { ASSETS } from "@/constants/assets";

const VAULT_ICON_BADGE_CLASS =
  "h-3.5 w-3.5 shrink-0 object-contain brightness-0 invert max-sm:h-3 max-sm:w-3";

/** Vault safe icon — inverted for dark UI (PSA Vault badge). */
export function PsaVaultLeadingIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      src={ASSETS.icons.psaVaultLeading}
      alt=""
      width={18}
      height={18}
      className={`${VAULT_ICON_BADGE_CLASS} ${className}`.trim()}
      aria-hidden
    />
  );
}
