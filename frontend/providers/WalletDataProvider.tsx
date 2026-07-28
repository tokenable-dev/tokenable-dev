"use client";

/**
 * WalletDataProvider
 *
 * Bridge between wagmi (Privy connector) and the Zustand store.
 * Ensures the app-selected network, polls USDC balance, and invalidates
 * React Query cache after any write transaction (via store.refresh()).
 */

import { useEffect, useRef } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { USDC_ABI } from "@/constants/contracts";
import { getPrimaryWalletAddress, normalizeWalletAddress } from "@/lib/auth/wallets";
import { useAppChain } from "@/providers/AppChainProvider";
import { useChainContracts } from "@/hooks/chain/useChainContracts";
import { useAppStore } from "@/store";
import { useAuthStore } from "@/store/authStore";
import { rq } from "@/lib/core";
import { ensureAppChainNetwork } from "@/lib/network";

const POLL_INTERVAL_MS = 8_000;

const CHAIN_QUERY_KEYS = [
  ["token-supply"],
  ["rwa-contract-info"],
] as const;

export function WalletDataProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chain, connector } = useAccount();
  const user = useAuthStore((s) => s.user);
  const accountPrimary = getPrimaryWalletAddress(user);
  const { chainId, chain: appChain } = useAppChain();
  const { usdcAddress } = useChainContracts();
  const hasAttemptedSwitch = useRef(false);

  useEffect(() => {
    if (!isConnected || !connector || chain?.id === chainId) {
      if (chain?.id === chainId) hasAttemptedSwitch.current = false;
      return;
    }

    const connected = normalizeWalletAddress(address);
    const primary = normalizeWalletAddress(accountPrimary);
    // Never prompt MetaMask (or other extensions) while aligning to the account wallet.
    if (primary && connected && connected !== primary) {
      return;
    }

    if (hasAttemptedSwitch.current) return;
    hasAttemptedSwitch.current = true;

    connector.getProvider().then((provider) => {
      const p = provider as {
        request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      } | null;
      if (!p?.request) return;
      ensureAppChainNetwork(
        p as Parameters<typeof ensureAppChainNetwork>[0],
        appChain,
      ).finally(() => {
        hasAttemptedSwitch.current = false;
      });
    });
  }, [isConnected, chain?.id, chainId, connector, appChain, address, accountPrimary]);

  const queryClient = useQueryClient();
  const _setWallet = useAppStore((s) => s._setWallet);
  const _setUsdcBalance = useAppStore((s) => s._setUsdcBalance);
  const refreshTick = useAppStore((s) => s.refreshTick);

  useEffect(() => {
    _setWallet(address, isConnected);
  }, [address, isConnected, _setWallet]);

  const { data: rawBalance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled: !!address && isConnected,
      refetchInterval: POLL_INTERVAL_MS,
    },
  });

  useEffect(() => {
    if (rawBalance !== undefined) {
      _setUsdcBalance(rawBalance as bigint);
    }
  }, [rawBalance, _setUsdcBalance]);

  useEffect(() => {
    if (refreshTick === 0) return;

    void refetchBalance();

    CHAIN_QUERY_KEYS.forEach((key) => {
      void queryClient.invalidateQueries({ queryKey: key });
    });

    if (address) {
      void queryClient.invalidateQueries({
        queryKey: ["token-balance", address],
      });
      void queryClient.invalidateQueries({
        queryKey: ["rwa-balance", address],
      });
      void queryClient.invalidateQueries({ queryKey: ["rwa-tokens"] });
    }
  }, [refreshTick, refetchBalance, queryClient, address]);

  return <>{children}</>;
}
