"use client";

import { useEnsureAccountWalletActive } from "@/hooks/auth/useEnsureAccountWalletActive";

/** Mount once inside PrivyProvider — silently selects the account embedded wallet. */
export function AccountWalletAligner() {
  useEnsureAccountWalletActive();
  return null;
}
