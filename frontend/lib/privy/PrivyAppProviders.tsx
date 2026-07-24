"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "@privy-io/wagmi";
import { useState, type ReactNode } from "react";
import {
  PRIVY_APP_ID,
  isPrivyEnabled,
  privyClientConfig,
  wagmiPrivyConfig,
} from "@/lib/privy/config";
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

  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={privyClientConfig}>
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
