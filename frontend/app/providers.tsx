"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/config/wagmi";
import { WalletDataProvider } from "@/providers/WalletDataProvider";
import { AuthProvider } from "@/providers/AuthProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {/* Syncs wagmi on-chain data → Zustand store for all children */}
        <AuthProvider>
          <WalletDataProvider>{children}</WalletDataProvider>
        </AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
