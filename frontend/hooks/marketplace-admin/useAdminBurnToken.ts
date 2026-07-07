"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { postAdminBurnRwaToken, rq } from "@/lib/core";
import { invalidateAfterBurn } from "@/lib/core/invalidation";

/** Admin-only: on-chain adminBurn via platform owner wallet (backend-signed). */
export function useAdminBurnToken(walletAddress?: string) {
  const queryClient = useQueryClient();
  const [burningTokenId, setBurningTokenId] = useState<number | null>(null);

  const burnToken = useCallback(
    async (
      tokenId: number,
      options?: { hasActiveListing?: boolean; alreadyBurned?: boolean },
    ) => {
      if (options?.alreadyBurned) {
        window.alert(`Token #${tokenId} is already burned.`);
        return;
      }
      const listingNote = options?.hasActiveListing
        ? " Any active listing will be cancelled automatically first."
        : "";
      if (
        !window.confirm(
          `Permanently burn token #${tokenId} on-chain?${listingNote} This cannot be undone.`,
        )
      ) {
        return;
      }
      setBurningTokenId(tokenId);
      try {
        const result = await postAdminBurnRwaToken(tokenId);
        await queryClient.invalidateQueries({ queryKey: rq.adminRwaCards() });
        await queryClient.invalidateQueries({ queryKey: rq.ordersActive() });
        if (walletAddress) {
          await invalidateAfterBurn(queryClient, walletAddress);
        }
        const cancelled =
          result.cancelledOrderHashes?.length > 0
            ? `\nCancelled listing(s): ${result.cancelledOrderHashes.length}`
            : "";
        window.alert(`Token #${tokenId} burned.${cancelled}\nTx: ${result.txHash}`);
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Failed to burn token",
        );
      } finally {
        setBurningTokenId(null);
      }
    },
    [queryClient, walletAddress],
  );

  return { burnToken, burningTokenId };
}
