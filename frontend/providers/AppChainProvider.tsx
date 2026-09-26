"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { canUseAppChainSwitcher } from "@/lib/auth/accountAccess";
import { completeSignOut } from "@/lib/auth/signOut";
import {
  CHAIN_ID_HEADER,
  DEFAULT_CHAIN_ID,
  platformDefaultChainId,
  getChainDefinition,
  getConfiguredChains,
  isChainConfigured,
  notifyAppChainChanged,
  setActiveChainIdForApi,
  APP_CHAIN_STORAGE_KEY,
  readPersistedAppChainId,
  type AppChainDefinition,
  type SupportedChainId,
} from "@/lib/chains";
import { runChainSwitchStorageHygiene } from "@/lib/chains/chainSwitchHygiene";
import { rq } from "@/lib/core";
import { useAuthStore } from "@/store/authStore";

const STORAGE_KEY = APP_CHAIN_STORAGE_KEY;

function isMarketplaceAdminPath(pathname: string | null): boolean {
  return Boolean(pathname?.startsWith("/marketplace/admin"));
}

type AppChainContextValue = {
  chainId: SupportedChainId;
  chain: AppChainDefinition;
  configuredChains: AppChainDefinition[];
  /** False until auth session + persisted chain are applied (skip chain-scoped fetches). */
  chainReady: boolean;
  setChainId: (chainId: SupportedChainId) => void;
  isConfigured: (chainId: SupportedChainId) => boolean;
};

const AppChainContext = createContext<AppChainContextValue | null>(null);

function readStoredChainId(internalDevBypass: boolean): SupportedChainId {
  const persisted = readPersistedAppChainId();
  if (!persisted) return platformDefaultChainId();
  // Local dev + internal dev on deploy: allow any configured chain (wallet switch / QA).
  if (process.env.NODE_ENV === "development" || internalDevBypass) {
    return persisted;
  }
  return DEFAULT_CHAIN_ID;
}

export function AppChainProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const authInitialized = useAuthStore((s) => s.initialized);
  // Admin console is multi-chain ops (custody / cards / roles) — not gated on
  // the public "internal dev" email allowlist.
  const adminConsole = isMarketplaceAdminPath(pathname);
  const canSwitchChain = canUseAppChainSwitcher(user) || adminConsole;
  const chainReady = adminConsole || authInitialized;
  const configuredChains = useMemo(() => getConfiguredChains(), []);
  // Always match SSR — restore persisted chain after mount (localStorage is client-only).
  const [chainId, setChainIdState] = useState<SupportedChainId>(() =>
    typeof window === "undefined" ? DEFAULT_CHAIN_ID : platformDefaultChainId(),
  );
  const prevChainRef = useRef<SupportedChainId | null>(null);

  const chain = useMemo(() => getChainDefinition(chainId), [chainId]);

  useEffect(() => {
    // Admin routes can restore stored chain before user JWT finishes; public
    // still waits for auth so we don't flash Polygon for anonymous visitors.
    if (!adminConsole && !authInitialized) return;
    const applyChain = (nextId: SupportedChainId) => {
      setChainIdState((prev) => (prev === nextId ? prev : nextId));
      setActiveChainIdForApi(nextId);
      notifyAppChainChanged();
    };

    if (canSwitchChain) {
      const restored = readStoredChainId(true);
      // Set immediately — don't wait for the chainId-effect below. Otherwise the
      // first mint/upload after login can still carry Sepolia (initial state)
      // while the UI already shows the restored Polygon selection.
      applyChain(restored);
      return;
    }
    // Signed-in users without the switcher always use the platform default.
    // Logged-out visitors keep a persisted dev chain (network switch signs out
    // without clobbering localStorage — see setChainId).
    const persisted = readPersistedAppChainId();
    const userNow = useAuthStore.getState().user;
    const nextId =
      !userNow && persisted ? persisted : platformDefaultChainId();
    applyChain(nextId);
  }, [authInitialized, canSwitchChain, adminConsole]);

  const setChainId = useCallback(
    (nextId: SupportedChainId) => {
      const allow =
        canUseAppChainSwitcher(useAuthStore.getState().user) ||
        isMarketplaceAdminPath(pathname);
      if (!allow) return;
      // Production bundles throw if contracts env is missing — never select unconfigured chains.
      if (!isChainConfigured(nextId)) return;
      if (chainId === nextId) return;
      runChainSwitchStorageHygiene(chainId, nextId);
      setChainIdState(nextId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, String(nextId));
      }
      setActiveChainIdForApi(nextId);
      notifyAppChainChanged();
      // Fresh Privy + wagmi session on the new chain — avoids stale wallet chain / MetaMask prompts.
      void completeSignOut();
    },
    [chainId, pathname],
  );

  useEffect(() => {
    setActiveChainIdForApi(chainId);
  }, [chainId]);

  useEffect(() => {
    const prev = prevChainRef.current;
    const chainChanged = prev != null && prev !== chainId;
    if (chainChanged) {
      runChainSwitchStorageHygiene(prev, chainId);
    }
    prevChainRef.current = chainId;
    if (!chainChanged) return;

    void queryClient.invalidateQueries({ queryKey: rq.homeMarketplaceFeed(chainId) });
    void queryClient.invalidateQueries({ queryKey: ["collections", "marketplace"] });
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
    void queryClient.invalidateQueries({ queryKey: ["rwa-tokens"] });
    void queryClient.invalidateQueries({ queryKey: ["rwa-metadata-batch"] });
    void queryClient.invalidateQueries({ queryKey: ["portfolio-holdings"] });
    void queryClient.invalidateQueries({ queryKey: ["portfolio-daily-snapshots"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
    void queryClient.invalidateQueries({ queryKey: ["portfolio-bids"] });
    void queryClient.invalidateQueries({ queryKey: ["user-watchlist"] });
    void queryClient.invalidateQueries({ queryKey: ["cardhedger-mint-previews"] });
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
    void queryClient.invalidateQueries({ queryKey: ["admin-collections-list"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-vault-submissions"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-vault-submission-counts"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-vault-submission"] });
    void queryClient.invalidateQueries({ queryKey: ["vault-submissions"] });
    void queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
    void queryClient.invalidateQueries({ queryKey: ["orders", "by-token-active"] });
    void queryClient.invalidateQueries({ queryKey: ["buyer-listing-alert"] });
    void queryClient.invalidateQueries({ queryKey: ["collection-grade-catalog"] });
    void queryClient.invalidateQueries({ queryKey: ["collection-grade-series"] });
    void queryClient.invalidateQueries({ queryKey: ["collection-ai-insight"] });
    void queryClient.invalidateQueries({ queryKey: ["token-collection-key"] });
    void queryClient.invalidateQueries({ queryKey: ["metadata-bucket-key"] });
    void queryClient.invalidateQueries({ queryKey: ["list-rwa-mint-preview"] });
  }, [chainId, queryClient]);

  const value = useMemo<AppChainContextValue>(
    () => ({
      chainId,
      chain,
      configuredChains,
      chainReady,
      setChainId,
      isConfigured: (id) => configuredChains.some((c) => c.id === id),
    }),
    [chainId, chain, configuredChains, chainReady, setChainId],
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
