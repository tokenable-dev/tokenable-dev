"use client";

/**
 * WalletDataProvider
 *
 * Bridge between wagmi and the Zustand store.
 * The ONLY place that reads on-chain state with wagmi hooks.
 *
 * Also acts as the single invalidation hub: whenever store.refresh() is
 * called (after any write transaction), this provider immediately:
 *   1. Re-fetches the USDC balance from the chain
 *   2. Invalidates all React Query keys that depend on chain state
 *
 * This way, calling refresh() from any component refreshes everything.
 */

import { useEffect, useRef } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { USDC_ADDRESS, USDC_ABI } from "@/constants/contracts";
import { besu } from "@/config/wagmi";
import { useAppStore } from "@/store";
import { ensureBesuNetwork } from "@/lib/ensureBesuNetwork";

const POLL_INTERVAL_MS = 8_000;

/** All React Query keys that should be invalidated after any write tx */
const CHAIN_QUERY_KEYS = [
  ["token-supply"],
  ["nft-contract-info"],
] as const;

export function WalletDataProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chain, connector } = useAccount();
  const hasAttemptedSwitch = useRef(false);

  // ── Ensure SkyAnd Chain on connect / wrong network ─────────────────────────
  useEffect(() => {
    if (!isConnected || !connector || chain?.id === besu.id) {
      if (chain?.id === besu.id) hasAttemptedSwitch.current = false;
      return;
    }
    if (hasAttemptedSwitch.current) return;
    hasAttemptedSwitch.current = true;

    connector.getProvider().then((provider) => {
      const p = provider as { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | null;
      if (!p?.request) return;
      ensureBesuNetwork(p as Parameters<typeof ensureBesuNetwork>[0])
        .finally(() => {
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
    chainId: besu.id,
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

    // Invalidate address-independent queries
    CHAIN_QUERY_KEYS.forEach((key) => {
      void queryClient.invalidateQueries({ queryKey: key });
    });

    // Invalidate address-dependent queries
    if (address) {
      void queryClient.invalidateQueries({ queryKey: ["token-balance", address] });
      void queryClient.invalidateQueries({ queryKey: ["nft-balance", address] });
      void queryClient.invalidateQueries({ queryKey: ["my-nft-ids", address] });
    }
  }, [refreshTick, refetchBalance, queryClient, address]);

  return <>{children}</>;
}
