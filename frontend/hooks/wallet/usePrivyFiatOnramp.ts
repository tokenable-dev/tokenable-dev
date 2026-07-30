"use client";

import { useCallback, useState } from "react";
import { useFundWallet, usePrivy } from "@privy-io/react-auth";
import { usePrivyFundingStatus } from "@/hooks/wallet/usePrivyFundingStatus";
import { isPrivyEnabled } from "@/lib/privy/config";
import {
  assertFundingChainSupported,
  formatPrivyFundingError,
  resolveDefaultFundingAmount,
  resolveFundingTargetCaip2,
  resolveFundingTargetChainId,
  resolvePrivyFundingEnvironment,
  shouldSkipFundingReadinessCheck,
  usesMoonPayFunding,
} from "@/lib/privy/funding";
import { getChainDefinition } from "@/lib/chains";
import { normalizeWalletAddress } from "@/lib/auth/wallets";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import { useAppChain } from "@/providers/AppChainProvider";

export function isPrivyFiatOnrampFeatureEnabled(): boolean {
  return isPrivyEnabled();
}

/**
 * Add funds via Privy `useFundWallet` with MoonPay as the preferred card provider.
 *
 * Do not use `useFiatOnramp` here — it multi-routes (Stripe/Meld/MoonPay) and Stripe
 * Embedded fails on Polygon USDC (`Unsupported asset` / `Init failed: r is not a function`).
 */
export function usePrivyFiatOnramp(options?: { onComplete?: () => void }) {
  const { authenticated } = usePrivy();
  const { chainId: appChainId } = useAppChain();
  const { fundWallet } = useFundWallet();
  const fundingStatus = usePrivyFundingStatus();
  const [inFlight, setInFlight] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const onComplete = options?.onComplete;

  const fundingChainId = resolveFundingTargetChainId(appChainId);
  const fundingTargetCaip2 = resolveFundingTargetCaip2(appChainId);
  const environment = resolvePrivyFundingEnvironment(fundingChainId);
  const skipReadinessCheck = shouldSkipFundingReadinessCheck(fundingChainId);

  const isLoadingConfig = fundingStatus.isLoading;
  const isConfigured =
    skipReadinessCheck ||
    (fundingStatus.ready === true && fundingStatus.chainAligned !== false);

  const canStart =
    isPrivyFiatOnrampFeatureEnabled() &&
    authenticated &&
    !inFlight &&
    !isLoadingConfig &&
    isConfigured &&
    usesMoonPayFunding(fundingChainId);

  const startFunding = useCallback(
    async (walletAddress: string | undefined) => {
      setLastError(null);

      const normalized = normalizeWalletAddress(walletAddress);
      if (!isPrivyFiatOnrampFeatureEnabled()) {
        setLastError("Wallet funding is not available.");
        return false;
      }
      if (!authenticated) {
        setLastError("Sign in to add funds.");
        return false;
      }
      if (!normalized) {
        setLastError("Account wallet is not ready yet. Please wait a moment.");
        return false;
      }
      if (fundingStatus.isLoading) {
        setLastError("Checking funding configuration…");
        return false;
      }

      try {
        assertFundingChainSupported(fundingChainId);
      } catch (err) {
        setLastError(formatPrivyFundingError(err));
        return false;
      }

      if (!skipReadinessCheck && fundingStatus.ready === false) {
        const detail = fundingStatus.checklist.slice(0, 2).join(" ");
        setLastError(
          detail ||
            [
              "MoonPay is not configured for this app.",
              "Enable Account Funding in the Privy Dashboard.",
              fundingStatus.dashboardUrl,
            ].join(" "),
        );
        return false;
      }
      if (!skipReadinessCheck && fundingStatus.chainAligned === false) {
        setLastError(
          "Privy Dashboard funding network does not match this app. Set Funding token to Polygon + USDC (or Ethereum + USDC).",
        );
        return false;
      }

      setInFlight(true);
      const defaultAmount = resolveDefaultFundingAmount();
      const chain = getChainDefinition(fundingChainId).viemChain;
      try {
        // Do not set `defaultFundingMethod: "card"` — that auto-opens MoonPay from a
        // useEffect after the amount step, which browsers treat as a non-gesture popup
        // and fails with "Unable to initialize flow" (@privy-io/popup trigger() → null).
        // Prefer MoonPay, but let the user click the funding method so the popup is allowed.
        await fundWallet({
          address: normalized,
          options: {
            chain,
            asset: "USDC",
            amount: defaultAmount,
            card: { preferredProvider: "moonpay" },
          },
        });
        trackEvent("fiat_onramp_started", {
          chain_id: fundingChainId,
          price: Number(defaultAmount),
          currency: "USD",
          provider: "moonpay",
        });
        onComplete?.();
        return true;
      } catch (err) {
        setLastError(formatPrivyFundingError(err));
        return false;
      } finally {
        setInFlight(false);
      }
    },
    [
      authenticated,
      fundingChainId,
      fundingStatus.chainAligned,
      fundingStatus.dashboardUrl,
      fundingStatus.isLoading,
      fundingStatus.ready,
      fundingStatus.checklist,
      fundWallet,
      onComplete,
      skipReadinessCheck,
    ],
  );

  return {
    startFunding,
    inFlight,
    lastError,
    clearError: () => setLastError(null),
    canStart,
    isConfigured,
    isLoadingConfig,
    skipReadinessCheck,
    fundingStatus,
    fundingTargetCaip2,
    fundingChainId,
    environment,
  };
}
