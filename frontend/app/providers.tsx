"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/config/wagmi";
import { configureMarketQueryDefaults } from "@/lib/core";
import { WalletDataProvider } from "@/providers/WalletDataProvider";
import { WalletConnectionSync } from "@/providers/WalletConnectionSync";
import { shouldAutoReconnectWalletOnMount } from "@/lib/wallet/walletEnvironment";
import { AuthProvider } from "@/providers/AuthProvider";
import { MarketplaceQueryPersistence } from "@/providers/MarketplaceQueryPersistence";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const c = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 10_000,
          retry: 1,
        },
      },
    });
    configureMarketQueryDefaults(c);
    return c;
  });

  return (
    <WagmiProvider
      config={wagmiConfig}
      reconnectOnMount={shouldAutoReconnectWalletOnMount()}
    >
      <QueryClientProvider client={queryClient}>
        <MarketplaceQueryPersistence />
        <WalletConnectionSync />
        {/* Syncs wagmi on-chain data → Zustand store for all children */}
        <AuthProvider>
          <WalletDataProvider>{children}</WalletDataProvider>
        </AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
