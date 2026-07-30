"use client";

/**
 * WalletDataProvider
 *
 * Bridge between wagmi (Privy connector) and the Zustand store.
 * Ensures the app-selected network, polls USDC balance, and invalidates
 * React Query cache after any write transaction (via store.refresh()).
 */

import { useEffect, useRef } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useAccount, useReadContract, useSwitchChain } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { USDC_ABI } from "@/constants/contracts";
import { getPrimaryWalletAddress, normalizeWalletAddress } from "@/lib/auth/wallets";
import { useAppChain } from "@/providers/AppChainProvider";
import { useChainContracts } from "@/hooks/chain/useChainContracts";
import { useAppStore } from "@/store";
import { useAuthStore } from "@/store/authStore";
import {
  ensurePrivyWalletOnChain,
  findPrivyWalletByAddress,
  parsePrivyWalletChainId,
  resolveAccountSigningWallet,
} from "@/lib/privy/wallet";
import { ensureAppChainNetwork } from "@/lib/network";

// Baseline USDC balance poll. Transactions trigger an immediate refetch via
// refreshTick, so this only needs to catch external transfers — 8s polling per
// connected wallet was the single biggest steady RPC drain under load.
const POLL_INTERVAL_MS = 30_000;

const CHAIN_QUERY_KEYS = [
  ["token-supply"],
  ["rwa-contract-info"],
] as const;

export function WalletDataProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chain, connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { wallets } = useWallets();
  const user = useAuthStore((s) => s.user);
  const accountPrimary = getPrimaryWalletAddress(user);
  const { chainId, chain: appChain } = useAppChain();
  const { usdcAddress } = useChainContracts();
  const hasAttemptedSwitch = useRef(false);
  const walletFingerprint = wallets.map((w) => `${w.address}:${w.chainId}`).join(",");

  useEffect(() => {
    const connected = normalizeWalletAddress(address);
    const primary = normalizeWalletAddress(accountPrimary);
    // Only ask the account's own wallet to switch networks. Before the backend
    // session resolves the primary, any connected browser extension would get a
    // wallet_switchEthereumChain prompt it never asked for.
    if (!isConnected || !primary || !connected || connected !== primary) {
      return;
    }

    const privyWallet =
      resolveAccountSigningWallet(wallets, primary) ??
      findPrivyWalletByAddress(wallets, primary);
    const privyOnAppChain =
      privyWallet != null && parsePrivyWalletChainId(privyWallet) === chainId;
    const wagmiOnAppChain = chain?.id === chainId;

    if (privyOnAppChain && wagmiOnAppChain) {
      hasAttemptedSwitch.current = false;
      return;
    }

    if (hasAttemptedSwitch.current) return;
    hasAttemptedSwitch.current = true;

    void (async () => {
      try {
        if (privyWallet && !privyOnAppChain) {
          // Privy approve/sign UIs read ConnectedWallet.chainId — must use
          // wallet.switchChain, not only EIP-1193 on a stale provider instance.
          await ensurePrivyWalletOnChain(privyWallet, chainId);
        }
        if (!wagmiOnAppChain) {
          try {
            await switchChainAsync({ chainId });
          } catch {
            const provider =
              (await privyWallet?.getEthereumProvider()) ??
              (await connector?.getProvider());
            const p = provider as {
              request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            } | null;
            if (p?.request) {
              await ensureAppChainNetwork(
                p as Parameters<typeof ensureAppChainNetwork>[0],
                appChain,
              );
            }
          }
        }
      } finally {
        hasAttemptedSwitch.current = false;
      }
    })();
  }, [
    isConnected,
    chain?.id,
    chainId,
    connector,
    appChain,
    address,
    accountPrimary,
    wallets,
    walletFingerprint,
    switchChainAsync,
  ]);

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
