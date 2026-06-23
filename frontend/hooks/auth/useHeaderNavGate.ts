"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import {
  resolveHeaderNavGate,
  type HeaderNavMinLevel,
} from "@/lib/auth/accountAccess";
import { resolveWalletSessionGate } from "@/lib/auth/walletSessionGate";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

export function useHeaderNavGate() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const openConnectWallet = useAuthUiStore((s) => s.openConnectWallet);
  const openWalletMismatch = useAuthUiStore((s) => s.openWalletMismatch);
  const openKyc = useAuthUiStore((s) => s.openKyc);
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();

  return useCallback(
    (href: string, minLevel: HeaderNavMinLevel) => {
      const gate = resolveHeaderNavGate(user, minLevel, href);
      switch (gate.action) {
        case "allow":
          if (minLevel >= 1) {
            const sessionGate = resolveWalletSessionGate(user, {
              address,
              isConnected,
              isConnecting,
              isReconnecting,
            });
            if (sessionGate.action === "wallet-mismatch") {
              openWalletMismatch({ returnTo: href });
              return;
            }
          }
          router.push(href);
          return;
        case "sign-in":
          openSignIn({ returnTo: gate.returnTo });
          return;
        case "connect-wallet":
          openConnectWallet({ returnTo: gate.returnTo });
          return;
        case "kyc":
          openKyc({ returnTo: gate.returnTo });
          return;
      }
    },
    [
      user,
      router,
      openSignIn,
      openConnectWallet,
      openWalletMismatch,
      openKyc,
      address,
      isConnected,
      isConnecting,
      isReconnecting,
    ],
  );
}
