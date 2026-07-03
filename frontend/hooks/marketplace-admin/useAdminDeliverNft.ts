"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { postAdminDeliverRwaToken, rq, type AdminCustodyNftRow } from "@/lib/core";

export function useAdminDeliverNft() {
  const queryClient = useQueryClient();
  const [deliveringTokenId, setDeliveringTokenId] = useState<number | null>(null);

  const deliverToken = useCallback(
    async (row: AdminCustodyNftRow) => {
      if (row.burnedAt) {
        window.alert(`Token #${row.tokenId} is already burned.`);
        return;
      }
      if (row.hasActiveListing) {
        window.alert("Cancel the active listing first, then deliver.");
        return;
      }
      if (!row.recipientPrimaryWallet) {
        window.alert(
          "Vault depositor has no linked wallet. Ask the user to sign in with Privy first.",
        );
        return;
      }

      const label =
        row.recipientUserEmail ??
        row.recipientUserName ??
        row.recipientPrimaryWallet;
      if (
        !window.confirm(
          `Deliver token #${row.tokenId} to ${label}\nWallet: ${row.recipientPrimaryWallet}`,
        )
      ) {
        return;
      }

      setDeliveringTokenId(row.tokenId);
      try {
        const result = await postAdminDeliverRwaToken(row.tokenId);
        await queryClient.invalidateQueries({ queryKey: rq.adminCustodyNfts() });
        await queryClient.invalidateQueries({ queryKey: rq.adminRwaCards() });
        window.alert(
          `Token #${row.tokenId} delivered.\nRecipient: ${result.recipientAddress}\nTx: ${result.txHash}`,
        );
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Failed to deliver NFT",
        );
      } finally {
        setDeliveringTokenId(null);
      }
    },
    [queryClient],
  );

  return { deliverToken, deliveringTokenId };
}
