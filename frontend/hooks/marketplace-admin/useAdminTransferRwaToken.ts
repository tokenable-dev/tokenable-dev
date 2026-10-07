"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAddress, isAddress } from "viem";
import { usePublicClient } from "wagmi";
import {
  TOKENABLE_RWA_READ_ABI,
  TOKENABLE_RWA_TRANSFER_ABI,
} from "@/constants/contracts";
import {
  postAdminCancelRwaListings,
} from "@/lib/core";
import { invalidateAfterWalletNftTransfer } from "@/lib/core/invalidation";
import { getChainContracts } from "@/lib/chains/registry";
import { userTxFees, waitForUserTxReceipt } from "@/lib/network";
import { usePrivyAwareWriteContract } from "@/hooks/wallet/usePrivyAwareWriteContract";
import { useAppChain } from "@/providers/AppChainProvider";

export function useAdminTransferRwaToken(connectedWallet?: string) {
  const queryClient = useQueryClient();
  const { chainId } = useAppChain();
  const publicClient = usePublicClient({ chainId });
  const { writeContractWithPrivyUi } = usePrivyAwareWriteContract();
  const [transferringTokenId, setTransferringTokenId] = useState<number | null>(
    null,
  );

  const transferToken = useCallback(
    async (
      tokenId: number,
      recipientRaw: string,
      options?: { hasActiveListing?: boolean; alreadyBurned?: boolean },
    ) => {
      if (options?.alreadyBurned) {
        window.alert(`Token #${tokenId} is burned — nothing to transfer.`);
        return;
      }
      const from = connectedWallet?.trim();
      if (!from || !isAddress(from)) {
        window.alert(
          "Connect the wallet that holds this NFT (top bar). Gas is paid from that wallet.",
        );
        return;
      }
      const recipientInput = recipientRaw.trim();
      if (!recipientInput || !isAddress(recipientInput)) {
        window.alert("Enter a valid recipient Ethereum address.");
        return;
      }
      const fromWallet = getAddress(from);
      const recipient = getAddress(recipientInput);
      if (recipient === fromWallet) {
        window.alert("Recipient must be different from your connected wallet.");
        return;
      }

      const listingNote = options?.hasActiveListing
        ? "\n\nActive marketplace listing(s) will be cancelled in the database first."
        : "";
      if (
        !window.confirm(
          `Send token #${tokenId} from your connected wallet to\n${recipient}?\n\nYou pay network gas.${listingNote}`,
        )
      ) {
        return;
      }

      if (!publicClient) {
        window.alert("Network client not ready — try again.");
        return;
      }

      const { rwaAddress } = getChainContracts(chainId);
      setTransferringTokenId(tokenId);
      try {
        const ownerRaw = await publicClient.readContract({
          address: rwaAddress,
          abi: TOKENABLE_RWA_READ_ABI,
          functionName: "ownerOf",
          args: [BigInt(tokenId)],
        });
        const owner = getAddress(ownerRaw as string);
        if (owner !== fromWallet) {
          throw new Error(
            `Token #${tokenId} is owned by ${owner}, not your connected wallet (${fromWallet}). Switch wallet or use custody deliver for platform-held NFTs.`,
          );
        }

        if (options?.hasActiveListing) {
          await postAdminCancelRwaListings(tokenId);
        }

        const fees = await userTxFees(publicClient);
        const hash = await writeContractWithPrivyUi({
          chainId,
          address: rwaAddress,
          abi: TOKENABLE_RWA_TRANSFER_ABI,
          functionName: "safeTransferFrom",
          args: [fromWallet, recipient, BigInt(tokenId)],
          ...fees,
          privyUi: {
            description: `Transfer RWA #${tokenId} to ${recipient.slice(0, 6)}…${recipient.slice(-4)}. You pay network gas.`,
          },
        });
        await waitForUserTxReceipt(publicClient, hash);

        await invalidateAfterWalletNftTransfer(queryClient, [
          fromWallet,
          recipient,
        ]);
        window.alert(
          `Token #${tokenId} transferred.\nTx: ${hash}\n\nRecipient: ${recipient}`,
        );
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Transfer failed",
        );
      } finally {
        setTransferringTokenId(null);
      }
    },
    [
      chainId,
      connectedWallet,
      publicClient,
      queryClient,
      writeContractWithPrivyUi,
    ],
  );

  return { transferToken, transferringTokenId };
}
