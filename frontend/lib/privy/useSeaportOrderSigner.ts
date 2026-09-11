"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth";
import { useMemo } from "react";
import { useAccount, useWalletClient } from "wagmi";
import type { Address } from "viem";
import { getPrimaryWalletAddress } from "@/lib/auth/wallets";
import { isPrivyEnabled } from "@/lib/privy/config";
import { createPrivySeaportSigner } from "@/lib/privy/signing";
import {
  findPrivyWalletByAddress,
  resolveAccountSigningWallet,
  shouldUsePrivySdkForSigning,
} from "@/lib/privy/wallet";
import {
  signSeaportOrderWithWalletClient,
  type SignSeaportOrderFn,
} from "@/lib/seaport/signSeaportOrder";
import { useAppChain } from "@/providers/AppChainProvider";
import { useAuthStore } from "@/store/authStore";

/** Account primary → Privy SDK; never MetaMask when embedded-only policy is on. */
export function useSeaportOrderSigner(): {
  signSeaportOrder: SignSeaportOrderFn | null;
  address: Address | undefined;
  usesPrivySdk: boolean;
} {
  const { chainId } = useAppChain();
  const user = useAuthStore((s) => s.user);
  const primaryAddress = getPrimaryWalletAddress(user);
  const { address: wagmiAddress, connector } = useAccount();
  const signingAddress = (primaryAddress ?? wagmiAddress) as Address | undefined;
  const { data: walletClient } = useWalletClient({ chainId });
  const { wallets } = useWallets();
  const { signTypedData: privySignTypedData } = usePrivy();

  const signingPrivyWallet = useMemo(
    () =>
      signingAddress
        ? (resolveAccountSigningWallet(wallets, signingAddress) ??
          findPrivyWalletByAddress(wallets, signingAddress))
        : undefined,
    [wallets, signingAddress],
  );

  const usesPrivySdk = useMemo(
    () =>
      shouldUsePrivySdkForSigning({
        privyEnabled: isPrivyEnabled(),
        activeWallet: signingPrivyWallet,
        accountPrimaryAddress: primaryAddress,
        connectorId: connector?.id,
        connectorName: connector?.name,
      }),
    [signingPrivyWallet, primaryAddress, connector?.id, connector?.name],
  );

  const signSeaportOrder = useMemo((): SignSeaportOrderFn | null => {
    if (!signingAddress) return null;

    if (usesPrivySdk && privySignTypedData) {
      return createPrivySeaportSigner(privySignTypedData, signingAddress, chainId);
    }

    if (walletClient && wagmiAddress === signingAddress) {
      return signSeaportOrderWithWalletClient(walletClient, chainId);
    }

    return null;
  }, [
    signingAddress,
    wagmiAddress,
    chainId,
    usesPrivySdk,
    privySignTypedData,
    walletClient,
  ]);

  return {
    signSeaportOrder,
    address: signingAddress,
    usesPrivySdk,
  };
}
