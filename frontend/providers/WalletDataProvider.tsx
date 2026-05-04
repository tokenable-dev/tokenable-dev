"use client";

/**
 * WalletDataProvider
 *
 * Bridge between wagmi and the Zustand store.
 * Ensures MetaMask is on Sepolia, polls USDC balance, and invalidates
 * React Query cache after any write transaction (via store.refresh()).
 */

import { useEffect, useRef } from "react";
import { useAccount, useReadContract } from "wagmi";
import { sepolia } from "@/config/wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { USDC_ADDRESS, USDC_ABI } from "@/constants/contracts";
import { useAppStore } from "@/store";
import { rq } from "@/lib/core";
import { ensureSepoliaNetwork } from "@/lib/network";

const POLL_INTERVAL_MS = 8_000;

const CHAIN_QUERY_KEYS = [
  ["token-supply"],
  ["rwa-contract-info"],
] as const;

export function WalletDataProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chain, connector } = useAccount();
  const hasAttemptedSwitch = useRef(false);

  // ── Ensure Sepolia on connect / wrong network ──────────────────────────────
  useEffect(() => {
    if (!isConnected || !connector || chain?.id === sepolia.id) {
      if (chain?.id === sepolia.id) hasAttemptedSwitch.current = false;
      return;
    }
    if (hasAttemptedSwitch.current) return;
    hasAttemptedSwitch.current = true;

    connector.getProvider().then((provider) => {
      const p = provider as {
        request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      } | null;
      if (!p?.request) return;
      ensureSepoliaNetwork(
        p as Parameters<typeof ensureSepoliaNetwork>[0]
      ).finally(() => {
        hasAttemptedSwitch.current = false;
      });
    });
  }, [isConnected, chain?.id, connector]);

  const queryClient = useQueryClient();
  const _setWallet = useAppStore((s) => s._setWallet);
  const _setUsdcBalance = useAppStore((s) => s._setUsdcBalance);
  const refreshTick = useAppStore((s) => s.refreshTick);

  // ── Sync wallet connection ─────────────────────────────────────────────────
  useEffect(() => {
    _setWallet(address, isConnected);
  }, [address, isConnected, _setWallet]);

  // ── Poll USDC balance ──────────────────────────────────────────────────────
  const { data: rawBalance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
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

  // ── On refresh: re-fetch balance + invalidate all chain-dependent queries ──
  useEffect(() => {
    if (refreshTick === 0) return;

    void refetchBalance();

    CHAIN_QUERY_KEYS.forEach((key) => {
      void queryClient.invalidateQueries({ queryKey: key });
    });

    if (address) {
      void queryClient.invalidateQueries({ queryKey: ["token-balance", address] });
      void queryClient.invalidateQueries({ queryKey: ["rwa-balance", address] });
      void queryClient.invalidateQueries({ queryKey: rq.rwaTokens(address) });
    }
  }, [refreshTick, refetchBalance, queryClient, address]);

  return <>{children}</>;
}
