"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useSwitchChain, useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { canUseAppChainSwitcher } from "@/lib/auth/accountAccess";
import { getPrimaryWalletAddress, normalizeWalletAddress } from "@/lib/auth/wallets";
import {
  CHAIN_ID_HEADER,
  DEFAULT_CHAIN_ID,
  SUPPORTED_CHAIN_IDS,
  getChainDefinition,
  getConfiguredChains,
  isChainConfigured,
  notifyAppChainChanged,
  setActiveChainIdForApi,
  APP_CHAIN_STORAGE_KEY,
  type AppChainDefinition,
  type SupportedChainId,
} from "@/lib/chains";
import { useAuthStore } from "@/store/authStore";

const STORAGE_KEY = APP_CHAIN_STORAGE_KEY;

/** Public users stay on Sepolia until mainnet launch. */
const PUBLIC_APP_CHAIN_ID = 11155111 as SupportedChainId;

function isMarketplaceAdminPath(pathname: string | null): boolean {
  return Boolean(pathname?.startsWith("/marketplace/admin"));
}

type AppChainContextValue = {
  chainId: SupportedChainId;
  chain: AppChainDefinition;
  configuredChains: AppChainDefinition[];
  setChainId: (chainId: SupportedChainId) => void;
  isConfigured: (chainId: SupportedChainId) => boolean;
};

const AppChainContext = createContext<AppChainContextValue | null>(null);

function readStoredChainId(internalDevBypass: boolean): SupportedChainId {
  if (typeof window === "undefined") return DEFAULT_CHAIN_ID;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const n = Number(raw);
  if (!SUPPORTED_CHAIN_IDS.includes(n as SupportedChainId)) return DEFAULT_CHAIN_ID;
  // Never restore an unconfigured chain (production throws on missing NEXT_PUBLIC_CHAIN_*).
  if (!isChainConfigured(n as SupportedChainId)) return DEFAULT_CHAIN_ID;
  // Local dev + internal dev on deploy: allow any configured chain (wallet switch / QA).
  if (process.env.NODE_ENV === "development" || internalDevBypass) {
    return n as SupportedChainId;
  }
  return DEFAULT_CHAIN_ID;
}

export function AppChainProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { switchChainAsync } = useSwitchChain();
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const authInitialized = useAuthStore((s) => s.initialized);
  // Admin console is multi-chain ops (custody / cards / roles) — not gated on
  // the public "internal dev" email allowlist.
  const adminConsole = isMarketplaceAdminPath(pathname);
  const canSwitchChain = canUseAppChainSwitcher(user) || adminConsole;
  const configuredChains = useMemo(() => getConfiguredChains(), []);
  // Always match SSR — restore persisted chain after mount (localStorage is client-only).
  const [chainId, setChainIdState] = useState<SupportedChainId>(PUBLIC_APP_CHAIN_ID);

  const chain = useMemo(() => getChainDefinition(chainId), [chainId]);

  useEffect(() => {
    // Admin routes can restore stored chain before user JWT finishes; public
    // still waits for auth so we don't flash Polygon for anonymous visitors.
    if (!adminConsole && !authInitialized) return;
    if (canSwitchChain) {
      const restored = readStoredChainId(true);
      setChainIdState(restored);
      // Set immediately — don't wait for the chainId-effect below. Otherwise the
      // first mint/upload after login can still carry Sepolia (initial state)
      // while the UI already shows the restored Polygon selection.
      setActiveChainIdForApi(restored);
      notifyAppChainChanged();
      return;
    }
    setChainIdState(PUBLIC_APP_CHAIN_ID);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(PUBLIC_APP_CHAIN_ID));
    }
    setActiveChainIdForApi(PUBLIC_APP_CHAIN_ID);
    notifyAppChainChanged();
  }, [authInitialized, canSwitchChain, adminConsole]);

  const setChainId = useCallback(
    (nextId: SupportedChainId) => {
      const allow =
        canUseAppChainSwitcher(useAuthStore.getState().user) ||
        isMarketplaceAdminPath(pathname);
      if (!allow) return;
      // Production bundles throw if contracts env is missing — never select unconfigured chains.
      if (!isChainConfigured(nextId)) return;
      setChainIdState(nextId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, String(nextId));
      }
      setActiveChainIdForApi(nextId);
      notifyAppChainChanged();
      const primary = normalizeWalletAddress(getPrimaryWalletAddress(useAuthStore.getState().user));
      const connected = normalizeWalletAddress(address);
      const canSwitchWalletChain =
        isConnected && (!primary || (connected && connected === primary));
      if (canSwitchWalletChain) {
        void switchChainAsync({ chainId: nextId }).catch(() => {
          /* wallet may switch later via WalletDataProvider */
        });
      }
    },
    [switchChainAsync, address, isConnected, pathname],
  );

  useEffect(() => {
    setActiveChainIdForApi(chainId);
    void queryClient.invalidateQueries({ queryKey: ["collections", "marketplace"] });
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
    void queryClient.invalidateQueries({ queryKey: ["rwa-tokens"] });
    void queryClient.invalidateQueries({ queryKey: ["rwa-metadata-batch"] });
    void queryClient.invalidateQueries({ queryKey: ["portfolio-holdings"] });
    void queryClient.invalidateQueries({ queryKey: ["portfolio-hidden"] });
    void queryClient.invalidateQueries({ queryKey: ["portfolio-daily-snapshots"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
    void queryClient.invalidateQueries({ queryKey: ["portfolio-bids"] });
    void queryClient.invalidateQueries({ queryKey: ["user-watchlist"] });
    void queryClient.invalidateQueries({ queryKey: ["cardhedger-mint-previews"] });
    void queryClient.invalidateQueries({ queryKey: ["portfolio-token-sparklines"] });
    void queryClient.invalidateQueries({ queryKey: ["p2p"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-rwa-cards"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-custody-nfts"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-rwa-roles-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-rwa-roles-status"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-bulk-mint-jobs"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-bulk-mint-job"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-partner-inventory"] });
    void queryClient.invalidateQueries({ queryKey: ["collection-snapshots"] });
    void queryClient.invalidateQueries({ queryKey: ["marketplace-collection"] });
    void queryClient.invalidateQueries({ queryKey: ["collection-market-series"] });
    void queryClient.invalidateQueries({ queryKey: ["collection-platform-trades"] });
    void queryClient.invalidateQueries({ queryKey: ["rwa-token-trades"] });
    void queryClient.invalidateQueries({ queryKey: ["portfolio-market-batch"] });
    void queryClient.invalidateQueries({ queryKey: ["collection-listings-metadata"] });
    void queryClient.invalidateQueries({ queryKey: ["portfolio-bid-collections"] });
    void queryClient.invalidateQueries({ queryKey: ["marketplace-detail-metadata"] });
    void queryClient.invalidateQueries({ queryKey: ["collection-owned-rwa"] });
  }, [chainId, queryClient]);

  const value = useMemo<AppChainContextValue>(
    () => ({
      chainId,
      chain,
      configuredChains,
      setChainId,
      isConfigured: (id) => configuredChains.some((c) => c.id === id),
    }),
    [chainId, chain, configuredChains, setChainId],
  );

  return <AppChainContext.Provider value={value}>{children}</AppChainContext.Provider>;
}

export function useAppChain(): AppChainContextValue {
  const ctx = useContext(AppChainContext);
  if (!ctx) {
    throw new Error("useAppChain must be used within AppChainProvider");
  }
  return ctx;
}

/** For API client — header name export for tests/docs. */
export { CHAIN_ID_HEADER };
