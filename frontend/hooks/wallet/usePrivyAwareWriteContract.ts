"use client";

import type { SendTransactionModalUIOptions } from "@privy-io/react-auth";
import { useSendTransaction, useWallets } from "@privy-io/react-auth";
import { useCallback, useMemo } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { type Abi, type Address, type Hash, encodeFunctionData } from "viem";
import { getPrimaryWalletAddress } from "@/lib/auth/wallets";
import { isPrivyEnabled } from "@/lib/privy/config";
import {
  ensurePrivyWalletOnChain,
  resolveAccountSigningWallet,
  shouldUsePrivySdkForSigning,
} from "@/lib/privy/wallet";
import { useAuthStore } from "@/store/authStore";

export type PrivyAwareWriteContractInput = {
  chainId: number;
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  /** Shown in Privy send/success modals when signing with an embedded wallet. */
  privyUi?: SendTransactionModalUIOptions;
};

/**
 * wagmi `writeContract` for external wallets; Privy `sendTransaction` + `uiOptions`
 * for embedded wallets (wagmi txs do not get rich Privy copy and ERC20 amounts are
 * omitted from the Details summary — only native `value` + gas).
 */
export function usePrivyAwareWriteContract() {
  const { writeContractAsync } = useWriteContract();
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useWallets();
  const user = useAuthStore((s) => s.user);
  const primaryAddress = getPrimaryWalletAddress(user);
  const { connector } = useAccount();

  const signingWallet = useMemo(
    () => resolveAccountSigningWallet(wallets, primaryAddress),
    [wallets, primaryAddress],
  );

  const usesPrivySdk = useMemo(
    () =>
      shouldUsePrivySdkForSigning({
        privyEnabled: isPrivyEnabled(),
        activeWallet: signingWallet,
        accountPrimaryAddress: primaryAddress,
        connectorId: connector?.id,
        connectorName: connector?.name,
      }),
    [signingWallet, primaryAddress, connector?.id, connector?.name],
  );

  const writeContractWithPrivyUi = useCallback(
    async (input: PrivyAwareWriteContractInput): Promise<Hash> => {
      if (
        usesPrivySdk &&
        sendTransaction &&
        signingWallet &&
        isPrivyEnabled()
      ) {
        await ensurePrivyWalletOnChain(signingWallet, input.chainId);
        const data = encodeFunctionData({
          abi: input.abi,
          functionName: input.functionName,
          args: input.args as readonly unknown[],
        });
        const { hash } = await sendTransaction(
          {
            to: input.address,
            data,
            chainId: input.chainId,
            value: BigInt(0),
            maxFeePerGas: input.maxFeePerGas,
            maxPriorityFeePerGas: input.maxPriorityFeePerGas,
          },
          {
            address: signingWallet.address,
            uiOptions: input.privyUi,
          },
        );
        return hash;
      }

      return writeContractAsync(
        input as Parameters<typeof writeContractAsync>[0],
      );
    },
    [usesPrivySdk, sendTransaction, signingWallet, writeContractAsync],
  );

  return { writeContractWithPrivyUi, usesPrivySdk };
}
