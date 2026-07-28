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
  setActiveChainIdForApi,
  type AppChainDefinition,
  type SupportedChainId,
} from "@/lib/chains";
import { useAuthStore } from "@/store/authStore";

const STORAGE_KEY = "tokenable:chainId";

/** Public users stay on Sepolia until mainnet launch. */
const PUBLIC_APP_CHAIN_ID = 11155111 as SupportedChainId;

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
  // Local dev + internal dev on deploy: allow any supported chain (wallet switch / QA).
  if (process.env.NODE_ENV === "development" || internalDevBypass) {
    return n as SupportedChainId;
  }
  const configured = getConfiguredChains();
  if (configured.some((c) => c.id === n)) return n as SupportedChainId;
  return DEFAULT_CHAIN_ID;
}

export function AppChainProvider({ children }: { children: ReactNode }) {
  const { switchChainAsync } = useSwitchChain();
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const authInitialized = useAuthStore((s) => s.initialized);
  const canSwitchChain = canUseAppChainSwitcher(user);
  const configuredChains = useMemo(() => getConfiguredChains(), []);
  // Always match SSR — restore persisted chain after mount (localStorage is client-only).
  const [chainId, setChainIdState] = useState<SupportedChainId>(PUBLIC_APP_CHAIN_ID);

  const chain = useMemo(() => getChainDefinition(chainId), [chainId]);

  useEffect(() => {
    if (!authInitialized) return;
    if (canSwitchChain) {
      setChainIdState(readStoredChainId(true));
      return;
    }
    setChainIdState(PUBLIC_APP_CHAIN_ID);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(PUBLIC_APP_CHAIN_ID));
    }
    setActiveChainIdForApi(PUBLIC_APP_CHAIN_ID);
  }, [authInitialized, canSwitchChain]);

  const setChainId = useCallback(
    (nextId: SupportedChainId) => {
      if (!canUseAppChainSwitcher(useAuthStore.getState().user)) return;
      setChainIdState(nextId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, String(nextId));
      }
      setActiveChainIdForApi(nextId);
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
    [switchChainAsync, address, isConnected],
  );

  useEffect(() => {
    setActiveChainIdForApi(chainId);
    void queryClient.invalidateQueries({ queryKey: ["collections", "marketplace"] });
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
    void queryClient.invalidateQueries({ queryKey: ["rwa-tokens"] });
    void queryClient.invalidateQueries({ queryKey: ["rwa-metadata-batch"] });
    void queryClient.invalidateQueries({ queryKey: ["portfolio-holdings"] });
    void queryClient.invalidateQueries({ queryKey: ["portfolio-hidden"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-rwa-cards"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-custody-nfts"] });
    void queryClient.invalidateQueries({ queryKey: ["collection-snapshots"] });
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
