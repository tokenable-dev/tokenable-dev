"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import type { AuthUser } from "@/lib/auth";
import {
  resolveHeaderNavGate,
  type HeaderNavMinLevel,
} from "@/lib/auth/accountAccess";
import { refreshPrivyAuthSession } from "@/lib/privy/session";
import { userHasLinkedWallet } from "@/lib/auth/wallets";
import { resolveWalletSessionGate } from "@/lib/auth/walletSessionGate";
import {
  isVaultPathAccessible,
  isVaultPublicPath,
  notifyVaultComingSoon,
} from "@/lib/vault/vaultAccess";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

export function useHeaderNavGate() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const openConnectWallet = useAuthUiStore((s) => s.openConnectWallet);
  const openWalletMismatch = useAuthUiStore((s) => s.openWalletMismatch);
  const openKyc = useAuthUiStore((s) => s.openKyc);
  const { authenticated, getAccessToken } = usePrivy();
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();

  return useCallback(
    (href: string, minLevel: HeaderNavMinLevel) => {
      if (isVaultPublicPath(href) && !isVaultPathAccessible(href)) {
        notifyVaultComingSoon();
        return;
      }

      const applyGate = (subject: AuthUser | null | undefined) => {
        const gate = resolveHeaderNavGate(subject, minLevel, href);
        switch (gate.action) {
          case "allow":
            if (minLevel >= 1) {
              const sessionGate = resolveWalletSessionGate(subject, {
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
      };

      // Privy session active but Tokenable user missing / wallet not yet linked — resync.
      if (authenticated && (!user || !userHasLinkedWallet(user))) {
        void refreshPrivyAuthSession(getAccessToken)
          .then((synced) => {
            if (synced) setUser(synced);
            applyGate(synced ?? user ?? null);
          })
          .catch(() => applyGate(user ?? null));
        return;
      }

      applyGate(user);
    },
    [
      user,
      authenticated,
      getAccessToken,
      setUser,
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
