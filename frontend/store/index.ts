/**
 * Global Zustand store — single source of truth for app-wide state.
 *
 * Blockchain data (USDC balance, etc.) is synced here by WalletDataProvider,
 * which polls the chain via wagmi. Components read from this store rather
 * than firing their own contract reads, so every view stays in sync.
 *
 * To add a new domain (e.g. staking, governance):
 *   1. Define its slice interface below
 *   2. Add it to AppStore
 *   3. Initialise in WalletDataProvider
 */

import { create } from "zustand";
import { formatUnits } from "viem";

// ─── Wallet slice ────────────────────────────────────────────────────────────

interface WalletSlice {
  address: `0x${string}` | undefined;
  isConnected: boolean;
  /** @internal called only from WalletDataProvider */
  _setWallet: (address: `0x${string}` | undefined, connected: boolean) => void;
}

// ─── USDC slice ───────────────────────────────────────────────────────────────

interface UsdcSlice {
  /** Raw on-chain balance (6 decimals) */
  usdcBalance: bigint;
  /** Human-readable balance string (e.g. "10000.00") */
  usdcBalanceFormatted: string;
  /** @internal called only from WalletDataProvider */
  _setUsdcBalance: (balance: bigint) => void;
}

// ─── Refresh slice ────────────────────────────────────────────────────────────

interface RefreshSlice {
  /**
   * Incrementing tick.  WalletDataProvider watches this and
   * re-fetches all on-chain data whenever it changes.
   * Call `refresh()` after any write transaction to get instant updates.
   */
  refreshTick: number;
  refresh: () => void;
}

// ─── Combined store ───────────────────────────────────────────────────────────

export type AppStore = WalletSlice & UsdcSlice & RefreshSlice;

export const useAppStore = create<AppStore>((set) => ({
  // Wallet
  address: undefined,
  isConnected: false,
  _setWallet: (address, isConnected) => set({ address, isConnected }),

  // USDC
  usdcBalance: BigInt(0),
  usdcBalanceFormatted: "0",
  _setUsdcBalance: (balance) =>
    set({
      usdcBalance: balance,
      usdcBalanceFormatted: formatUnits(balance, 6),
    }),

  // Refresh
  refreshTick: 0,
  refresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),
}));

// ─── Selector helpers ─────────────────────────────────────────────────────────
// Use these in components to avoid subscribing to the whole store.

export const selectWallet = (s: AppStore) => ({
  address: s.address,
  isConnected: s.isConnected,
});

export const selectUsdcBalance = (s: AppStore) => ({
  usdcBalance: s.usdcBalance,
  usdcBalanceFormatted: s.usdcBalanceFormatted,
});

export const selectRefresh = (s: AppStore) => s.refresh;

export { useAuthStore } from "./authStore";
export { useAuthUiStore } from "./authUiStore";
