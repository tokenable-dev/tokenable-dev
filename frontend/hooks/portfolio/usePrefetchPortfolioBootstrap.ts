"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLinkedPortfolioWallet } from "@/hooks/auth/useLinkedPortfolioWallet";
import { activeRqChainId } from "@/lib/chains";
import { isLinkedPortfolioViewAddress } from "@/lib/auth/wallets";
import { isPortfolioRoute } from "@/lib/portfolio/portfolioPaths";
import {
  PORTFOLIO_BOOTSTRAP_STALE_MS,
  postPortfolioAssetsPage,
} from "@/lib/core/api/portfolio-assets-page";
import { rq } from "@/lib/core";
import { useAuthStore } from "@/store/authStore";

/**
 * Warm `bootstrapFirstPage` after session + linked wallet are ready so the first
 * `/portfolio` visit hits React Query cache (same key as `usePortfolioAssetsPage`).
 */
export function usePrefetchPortfolioBootstrap() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const authInitialized = useAuthStore((s) => s.initialized);
  const privySessionSyncing = useAuthStore((s) => s.privySessionSyncing);
  const { portfolioAddress, hasLinkedWallet } = useLinkedPortfolioWallet();
  const chainId = activeRqChainId();
  const inFlightRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authInitialized || privySessionSyncing) return;
    if (!user || !hasLinkedWallet || !portfolioAddress?.trim()) return;
    if (!isLinkedPortfolioViewAddress(user, portfolioAddress)) return;
    if (isPortfolioRoute(pathname)) return;

    const wallet = portfolioAddress.trim();
    const queryKey = rq.portfolioAssetsPageBootstrap(wallet, chainId);
    const dedupeKey = `${chainId}:${wallet.toLowerCase()}`;

    const existing = queryClient.getQueryState(queryKey);
    if (
      existing?.fetchStatus === "fetching" ||
      inFlightRef.current === dedupeKey
    ) {
      return;
    }
    if (
      existing?.status === "success" &&
      existing.dataUpdatedAt != null &&
      Date.now() - existing.dataUpdatedAt < PORTFOLIO_BOOTSTRAP_STALE_MS
    ) {
      return;
    }

    const run = () => {
      if (inFlightRef.current === dedupeKey) return;
      inFlightRef.current = dedupeKey;
      void queryClient
        .prefetchQuery({
          queryKey,
          queryFn: () =>
            postPortfolioAssetsPage({
              walletAddress: wallet,
              bootstrapFirstPage: true,
            }),
          staleTime: PORTFOLIO_BOOTSTRAP_STALE_MS,
        })
        .finally(() => {
          if (inFlightRef.current === dedupeKey) {
            inFlightRef.current = null;
          }
        });
    };

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 0);
    return () => window.clearTimeout(t);
  }, [
    authInitialized,
    privySessionSyncing,
    user,
    hasLinkedWallet,
    portfolioAddress,
    chainId,
    pathname,
    queryClient,
  ]);
}
