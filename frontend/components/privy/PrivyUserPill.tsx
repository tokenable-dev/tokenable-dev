"use client";

import type { ComponentProps } from "react";
import { UserPill } from "@privy-io/react-auth/ui";
import { useClientMounted } from "@/hooks/ui/useClientMounted";

export type PrivyUserPillProps = ComponentProps<typeof UserPill> & {
  fallbackClassName?: string;
};

const DEFAULT_FALLBACK =
  "h-10 w-[7.5rem] animate-pulse rounded-xl border border-gray-800/60 bg-gray-900/50";

/**
 * Privy UserPill gated to client mount — avoids Next.js hydration mismatches
 * (Privy reads browser storage during render).
 */
export function PrivyUserPill({
  fallbackClassName = DEFAULT_FALLBACK,
  ...props
}: PrivyUserPillProps) {
  const mounted = useClientMounted();

  if (!mounted) {
    return <div className={fallbackClassName} aria-hidden />;
  }

  return <UserPill {...props} />;
}
