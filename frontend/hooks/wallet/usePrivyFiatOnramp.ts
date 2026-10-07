"use client";

import { useCallback, useState } from "react";
import { useFundWallet, usePrivy } from "@privy-io/react-auth";
import { usePrivyFundingStatus } from "@/hooks/wallet/usePrivyFundingStatus";
import { isPrivyEnabled } from "@/lib/privy/config";
import { requestFiatAggregatorFunding } from "@/lib/privy/fiatAggregatorBridge";
import {
  assertFundingChainSupported,
  formatPrivyFundingError,
  PRIVY_FIAT_ONRAMP_SOURCE_ASSETS,
  resolveDefaultFiatOnrampAsset,
  resolveDefaultFundingAmount,
  resolveFundingTargetCaip2,
  resolveFundingTargetChainId,
  resolveFundingUsdcContractAddress,
  resolvePrivyFundingEnvironment,
  shouldSkipFundingReadinessCheck,
  shouldUsePrivyFiatAggregator,
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
 * Add funds: mainnet uses Privy fiat aggregator (lazy-loaded — KRW / Meld / MoonPay).
 * Sepolia sandbox QA still uses `useFundWallet` + MoonPay when enabled.
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
  const useAggregator = shouldUsePrivyFiatAggregator(fundingChainId);
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
              "Wallet funding is not configured for this Privy app.",
              "Enable Account Funding (MoonPay + Meld for Korea) in the Privy Dashboard.",
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
      const defaultFiat = resolveDefaultFiatOnrampAsset();

      try {
        if (useAggregator) {
          const usdc = resolveFundingUsdcContractAddress(fundingChainId);
          const agg = await requestFiatAggregatorFunding({
            source: {
              assets: [...PRIVY_FIAT_ONRAMP_SOURCE_ASSETS],
              defaultAsset: defaultFiat,
            },
            destination: {
              asset: usdc,
              chain: fundingTargetCaip2,
              address: normalized,
            },
            environment,
            defaultAmount,
          });
          if (!agg.ok) {
            setLastError(
              agg.errorMessage ??
                "Funding was cancelled or could not be completed. Try again or send USDC to your wallet address.",
            );
            return false;
          }
          trackEvent("fiat_onramp_started", {
            chain_id: fundingChainId,
            price: Number(defaultAmount),
            currency: defaultFiat.toUpperCase(),
            provider: "privy_aggregator",
          });
        } else {
          const chain = getChainDefinition(fundingChainId).viemChain;
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
        }
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
      fundWallet,
      fundingChainId,
      fundingStatus.chainAligned,
      fundingStatus.dashboardUrl,
      fundingStatus.isLoading,
      fundingStatus.ready,
      fundingStatus.checklist,
      fundingTargetCaip2,
      onComplete,
      skipReadinessCheck,
      useAggregator,
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
    useAggregator,
  };
}
