"use client";

import { useCallback, useState } from "react";
import { useFiatOnramp, usePrivy } from "@privy-io/react-auth";
import { usePrivyFundingStatus } from "@/hooks/wallet/usePrivyFundingStatus";
import { isPrivyEnabled } from "@/lib/privy/config";
import {
  formatPrivyFundingError,
  parseCaip2EvmChainId,
  resolveDefaultFundingAmount,
  resolveFundingTargetCaip2,
  resolvePrivyFundingEnvironment,
  shouldSkipFundingReadinessCheck,
  TOKENABLE_FUNDING_ASSET,
} from "@/lib/privy/funding";
import { normalizeWalletAddress } from "@/lib/auth/wallets";
import { trackEvent } from "@/lib/analytics/googleAnalytics";

export function isPrivyFiatOnrampFeatureEnabled(): boolean {
  return isPrivyEnabled();
}

/**
 * MoonPay fiat on-ramp via Privy `useFiatOnramp`.
 * Checkout supports card, Apple Pay, and Google Pay when Dashboard + environment allow.
 */
export function usePrivyFiatOnramp(options?: { onComplete?: () => void }) {
  const { authenticated } = usePrivy();
  const { fund: startFiatOnramp } = useFiatOnramp();
  const fundingStatus = usePrivyFundingStatus();
  const [inFlight, setInFlight] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const onComplete = options?.onComplete;

  const fundingTargetCaip2 = resolveFundingTargetCaip2();
  const environment = resolvePrivyFundingEnvironment();
  const skipReadinessCheck = shouldSkipFundingReadinessCheck();

  const isLoadingConfig = fundingStatus.isLoading;
  const isConfigured =
    skipReadinessCheck ||
    (fundingStatus.ready === true && fundingStatus.chainAligned !== false);

  const canStart =
    isPrivyFiatOnrampFeatureEnabled() &&
    authenticated &&
    !inFlight &&
    !isLoadingConfig &&
    isConfigured;

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
          "Privy Dashboard funding network does not match this app. Set Funding token to Ethereum + USDC (mainnet in Dashboard is OK — app sends to Sepolia via env).",
        );
        return false;
      }

      setInFlight(true);
      const defaultAmount = resolveDefaultFundingAmount();
      try {
        await startFiatOnramp({
          destination: {
            // MoonPay via Privy expects the asset symbol here — contract address breaks quotes (Stripe path).
            asset: TOKENABLE_FUNDING_ASSET,
            chain: fundingTargetCaip2,
            address: normalized,
          },
          source: { assets: ["usd"], defaultAsset: "usd" },
          environment,
          defaultAmount,
        });
        trackEvent("fiat_onramp_started", {
          chain_id: parseCaip2EvmChainId(fundingTargetCaip2) ?? undefined,
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
      environment,
      fundingStatus.chainAligned,
      fundingStatus.dashboardUrl,
      fundingStatus.isLoading,
      fundingStatus.ready,
      fundingStatus.checklist,
      fundingTargetCaip2,
      onComplete,
      skipReadinessCheck,
      startFiatOnramp,
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
    environment,
  };
}
