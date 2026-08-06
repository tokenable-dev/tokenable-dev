"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppChain } from "@/providers/AppChainProvider";
import {
  REDEEM_BATCH_MAX,
  certNumberFromMetadata,
  isRedeemEligible,
  writeRedeemDraft,
  type RedeemDraftCard,
} from "@/lib/portfolio/redeemDraft";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import { formatPortfolioGradeLabel } from "@/lib/portfolio/portfolioTableHelpers";
import type { RwaMetadata } from "@/lib/core";

export function useRedeemSelection(input: {
  assetRows: AssetRow[];
  metadataByTokenId: Map<number, RwaMetadata | null>;
  redeemStatusByTokenId: Map<number, string>;
  vaultLabelByTokenId?: Map<number, string>;
}) {
  const router = useRouter();
  const { chainId } = useAppChain();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [limitError, setLimitError] = useState<string | null>(null);

  const eligibleIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of input.assetRows) {
      if (
        isRedeemEligible({
          listPriceUsd: row.listPriceUsd,
          activeListingOrderHash: row.activeListingOrderHash,
          redeemStatus: input.redeemStatusByTokenId.get(row.tokenId) ?? null,
        })
      ) {
        ids.add(row.tokenId);
      }
    }
    return ids;
  }, [input.assetRows, input.redeemStatusByTokenId]);

  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
    setSelected(new Set());
    setLimitError(null);
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
    setLimitError(null);
  }, []);

  const toggleToken = useCallback(
    (tokenId: number, nextChecked: boolean) => {
      if (!eligibleIds.has(tokenId)) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (nextChecked) {
          if (next.size >= REDEEM_BATCH_MAX) {
            setLimitError(
              `You can redeem up to ${REDEEM_BATCH_MAX} cards per shipment.`,
            );
            return prev;
          }
          next.add(tokenId);
          setLimitError(null);
        } else {
          next.delete(tokenId);
          setLimitError(null);
        }
        return next;
      });
    },
    [eligibleIds],
  );

  const goToRedeem = useCallback(() => {
    if (selected.size === 0) return;
    const cards: RedeemDraftCard[] = [];
    for (const tokenId of selected) {
      const row = input.assetRows.find((r) => r.tokenId === tokenId);
      if (!row) continue;
      const meta = input.metadataByTokenId.get(tokenId) ?? null;
      cards.push({
        tokenId,
        name: row.name,
        imageUrl: row.imageUrl,
        grade: formatPortfolioGradeLabel(meta),
        certNumber: certNumberFromMetadata(meta),
        vaultLabel:
          input.vaultLabelByTokenId?.get(tokenId) ?? "PSA Vault",
      });
    }
    if (cards.length === 0) return;
    writeRedeemDraft({ chainId, cards, savedAt: Date.now() });
    router.push("/portfolio/redeem");
  }, [
    selected,
    input.assetRows,
    input.metadataByTokenId,
    input.vaultLabelByTokenId,
    chainId,
    router,
  ]);

  return {
    selectMode,
    selected,
    selectedCount: selected.size,
    eligibleIds,
    limitError,
    enterSelectMode,
    exitSelectMode,
    toggleToken,
    goToRedeem,
    maxBatch: REDEEM_BATCH_MAX,
  };
}
