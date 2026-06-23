"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "viem/chains";
import { invalidateAfterBurn } from "@/lib/core/invalidation";
import {
  TOKENABLE_RWA_ADDRESS,
  TOKENABLE_RWA_TRANSFER_ABI,
} from "@/constants/contracts";

const TEST_BURN_TO_ADDRESS = "0x88CE98390ACA24C6A232946dc94EC12794f85FB2" as const;

/** Admin-only: transfer owned RWA token to test burn address. */
export function useAdminBurnToken(adminWallet: string | undefined) {
  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { writeContractAsync } = useWriteContract();
  const [burningTokenId, setBurningTokenId] = useState<number | null>(null);

  const burnToken = useCallback(
    async (tokenId: number, options?: { hasActiveListing?: boolean }) => {
      if (!adminWallet || !publicClient) return;
      if (options?.hasActiveListing) {
        window.alert("Cancel the active listing first, then burn.");
        return;
      }
      if (
        !window.confirm(
          `Send token #${tokenId} to burn test address ${TEST_BURN_TO_ADDRESS}? This is not reversible.`,
        )
      ) {
        return;
      }
      setBurningTokenId(tokenId);
      try {
        const txHash = await writeContractAsync({
          address: TOKENABLE_RWA_ADDRESS,
          abi: TOKENABLE_RWA_TRANSFER_ABI,
          functionName: "transferFrom",
          args: [
            adminWallet as `0x${string}`,
            TEST_BURN_TO_ADDRESS,
            BigInt(tokenId),
          ],
          chainId: sepolia.id,
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        await invalidateAfterBurn(queryClient, adminWallet);
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Failed to burn-transfer token",
        );
      } finally {
        setBurningTokenId(null);
      }
    },
    [adminWallet, publicClient, queryClient, writeContractAsync],
  );

  return { burningTokenId, burnToken };
}
