"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { postAdminConfirmRedemptionRelease, rq } from "@/lib/core";
import { useAppChain } from "@/providers/AppChainProvider";

export function useAdminConfirmRelease() {
  const queryClient = useQueryClient();
  const { chainId } = useAppChain();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const confirmRelease = useCallback(
    async (redemptionId: string, tokenId: number) => {
      const ok = window.confirm(
        `Confirm physical release for token #${tokenId}? The owner will be notified that shipment is on the way.`,
      );
      if (!ok) return;
      setConfirmingId(redemptionId);
      try {
        await postAdminConfirmRedemptionRelease(redemptionId);
        await queryClient.invalidateQueries({
          queryKey: rq.adminRwaCards(chainId),
        });
        window.alert(`Release confirmed for token #${tokenId}.`);
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Failed to confirm release",
        );
      } finally {
        setConfirmingId(null);
      }
    },
    [queryClient, chainId],
  );

  return { confirmRelease, confirmingId };
}
