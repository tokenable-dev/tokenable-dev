"use client";

import { useCallback, useRef, useState } from "react";
import { getAddress } from "viem";
import { useSignMessage } from "wagmi";
import {
  fetchWalletLinkChallenge,
  linkWalletToAccount,
} from "@/lib/wallet/linkWalletFlow";
import { isUserWalletLinked, userHasLinkedWallet } from "@/lib/auth/wallets";
import { useAuthStore } from "@/store/authStore";

function shortenApiError(message: string): string {
  if (message.includes("already linked")) return "Wallet already in use";
  if (message.includes("Signature")) return "Signature rejected";
  if (message.includes("challenge")) return "Try again";
  return message.length > 48 ? "Could not link wallet" : message;
}

export function useWalletLink() {
  const refresh = useAuthStore((s) => s.refresh);
  const user = useAuthStore((s) => s.user);
  const { signMessageAsync } = useSignMessage();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const isLinkedTo = useCallback(
    (address: string | undefined): boolean => isUserWalletLinked(user, address),
    [user],
  );

  const linkAddress = useCallback(
    async (address: string): Promise<boolean> => {
      if (inFlight.current) return false;
      let checksummed: `0x${string}`;
      try {
        checksummed = getAddress(address);
      } catch {
        setError("Invalid wallet address");
        return false;
      }
      if (isLinkedTo(checksummed)) return true;

      inFlight.current = true;
      setLinking(true);
      setError(null);
      try {
        const { message, challenge } = await fetchWalletLinkChallenge();
        const signature = await signMessageAsync({ message });
        await linkWalletToAccount({
          address: checksummed,
          signature,
          challenge,
        });
        await refresh();
        return true;
      } catch (e) {
        setError(shortenApiError(e instanceof Error ? e.message : "Link failed"));
        return false;
      } finally {
        inFlight.current = false;
        setLinking(false);
      }
    },
    [isLinkedTo, refresh, signMessageAsync],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    linking,
    error,
    isLinkedTo,
    linkAddress,
    clearError,
    hasLinkedWallet: userHasLinkedWallet(user),
    linkedAddress: user?.walletAddress ?? null,
  };
}
