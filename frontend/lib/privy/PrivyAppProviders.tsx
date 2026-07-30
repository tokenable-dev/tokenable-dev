"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "@privy-io/wagmi";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  PRIVY_APP_ID,
  buildPrivyClientConfig,
  isPrivyEnabled,
  wagmiPrivyConfig,
} from "@/lib/privy/config";
import {
  resolveFundingTargetChainId,
  resolvePrivyFundingEnvironment,
} from "@/lib/privy/funding";
import {
  APP_CHAIN_CHANGED_EVENT,
  APP_CHAIN_STORAGE_KEY,
  DEFAULT_CHAIN_ID,
  SUPPORTED_CHAIN_IDS,
  isChainConfigured,
  type SupportedChainId,
} from "@/lib/chains";
import { configureMarketQueryDefaults } from "@/lib/core";
import { useEnsureAccountWalletActive } from "@/hooks/auth/useEnsureAccountWalletActive";
import { PrivySessionBridge } from "@/lib/privy/PrivySessionBridge";
import { PrivySignInLauncher } from "@/lib/privy/PrivySignInLauncher";
import { PrivyWalletLauncher } from "@/lib/privy/PrivyWalletLauncher";
import { WalletDataProvider } from "@/providers/WalletDataProvider";
import { AppChainProvider } from "@/providers/AppChainProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { MarketplaceQueryPersistence } from "@/providers/MarketplaceQueryPersistence";
import { PerfObservers } from "@/lib/perf/PerfObservers";

/** Mount once inside PrivyProvider — silently selects the account embedded wallet. */
function AccountWalletAligner() {
  useEnsureAccountWalletActive();
  return null;
}

function readStoredAppChainId(): SupportedChainId {
  if (typeof window === "undefined") return DEFAULT_CHAIN_ID;
  const n = Number(window.localStorage.getItem(APP_CHAIN_STORAGE_KEY));
  if (
    SUPPORTED_CHAIN_IDS.includes(n as SupportedChainId) &&
    isChainConfigured(n as SupportedChainId)
  ) {
    return n as SupportedChainId;
  }
  return DEFAULT_CHAIN_ID;
}

/**
 * PrivyProvider sits above AppChainProvider, so we mirror the stored app chain
 * to flip MoonPay `useSandbox` when internal-dev switches Sepolia ↔ Polygon.
 * Privy recomputes appConfig when `config` identity changes (useMemo deps).
 */
function useMoonPaySandboxFromAppChain(): boolean {
  const [appChainId, setAppChainId] = useState<SupportedChainId>(DEFAULT_CHAIN_ID);

  useEffect(() => {
    const sync = () => setAppChainId(readStoredAppChainId());
    sync();
    window.addEventListener(APP_CHAIN_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(APP_CHAIN_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const fundingChainId = resolveFundingTargetChainId(appChainId);
  return resolvePrivyFundingEnvironment(fundingChainId) === "sandbox";
}

function PrivyAppTree({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const c = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 10_000,
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    });
    configureMarketQueryDefaults(c);
    return c;
  });

  const useSandbox = useMoonPaySandboxFromAppChain();
  const privyConfig = useMemo(
    () => buildPrivyClientConfig({ useSandbox }),
    [useSandbox],
  );

  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <PerfObservers />
        <WagmiProvider config={wagmiPrivyConfig} reconnectOnMount={false}>
          <MarketplaceQueryPersistence />
          <PrivySignInLauncher />
          <PrivyWalletLauncher />
          <PrivySessionBridge />
          <AccountWalletAligner />
          <AuthProvider>
            <AppChainProvider>
              <WalletDataProvider>{children}</WalletDataProvider>
            </AppChainProvider>
          </AuthProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

/** Root Privy + wagmi provider tree. No-op when `NEXT_PUBLIC_PRIVY_APP_ID` is unset. */
export function PrivyAppProviders({ children }: { children: ReactNode }) {
  if (!isPrivyEnabled()) {
    return <>{children}</>;
  }
  return <PrivyAppTree>{children}</PrivyAppTree>;
}
