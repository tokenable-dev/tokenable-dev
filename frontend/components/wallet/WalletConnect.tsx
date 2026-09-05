"use client";

import { PrivyUserPill } from "@/components/privy/PrivyUserPill";

/** Opens Privy's native wallet connection flow. */
export function WalletConnect() {
  return (
    <PrivyUserPill
      action={{
        type: "connectWallet",
        options: { description: "Connect a wallet to continue" },
      }}
    />
  );
}
