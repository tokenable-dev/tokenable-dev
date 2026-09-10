"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListRwaModal } from "@/components/marketplace/list-rwa/ListRwaModal";
import { PortfolioCancelListingConfirmModal } from "@/components/portfolio/PortfolioCancelListingConfirmModal";
import { PortfolioCertificateView } from "@/components/portfolio/PortfolioCertificateView";
import { usePortfolioCertificate } from "@/hooks/portfolio/usePortfolioCertificate";
import { usePortfolioHoldingActions } from "@/hooks/portfolio/usePortfolioHoldingActions";
import { useAppChain } from "@/providers/AppChainProvider";
import { activeRqChainId } from "@/lib/chains";
import {
  getMarketplaceCollectionDetailOrNull,
  rq,
} from "@/lib/core";
import { invalidateAfterListing } from "@/lib/core/invalidation";
import {
  certNumberFromMetadata,
  writeRedeemDraft,
} from "@/lib/portfolio/redeemDraft";
import { formatPortfolioGradeLabel } from "@/lib/portfolio/portfolioAssetMeta";
import {
  formatRedeemCardLine1FromMetadata,
  listPriceSheetIdentity,
} from "@/lib/portfolio/portfolioTableHelpers";
import {
  PARTNER_PORTFOLIO_PATH,
  PORTFOLIO_PATH,
} from "@/lib/portfolio/portfolioPaths";

export function PortfolioCertificatePage({
  variant,
}: {
  variant: "collector" | "partner";
}) {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const raw = params.tokenId;
  const tokenId = Number(Array.isArray(raw) ? raw[0] : raw);
  const tokenIdOk = Number.isFinite(tokenId) && tokenId >= 0;
  const backHref = variant === "partner" ? PARTNER_PORTFOLIO_PATH : PORTFOLIO_PATH;
  const data = usePortfolioCertificate(tokenId, tokenIdOk);
  const { chainId } = useAppChain();
  const rqChainId = activeRqChainId();
  const [listOpen, setListOpen] = useState(false);
  const [cancelListingConfirm, setCancelListingConfirm] = useState<{
    orderHash: string;
    listPriceUsd: number | null;
  } | null>(null);

  const holdingActions = usePortfolioHoldingActions({
    address: data.walletAddress ?? undefined,
    tokenIds: tokenIdOk ? [tokenId] : [],
    queryClient,
    refetchActiveOrders: () =>
      queryClient.invalidateQueries({ queryKey: rq.orderByToken(tokenId) }),
  });

  const collectionKey = data.collectionKey;
  const bidsQuery = useQuery({
    queryKey: rq.collectionDetail(collectionKey ?? "", rqChainId),
    queryFn: () => getMarketplaceCollectionDetailOrNull(collectionKey!),
    enabled: listOpen && Boolean(collectionKey),
    staleTime: 15_000,
  });

  const startRedeem = () => {
    /* An open redemption resumes where it left off instead of starting a new one. */
    if (data.redeemBadge?.statusHref) {
      router.push(data.redeemBadge.statusHref);
      return;
    }
    if (!data.isOwner || data.listed) return;
    writeRedeemDraft({
      chainId,
      savedAt: Date.now(),
      cards: [
        {
          tokenId,
          name: formatRedeemCardLine1FromMetadata(
            data.metadata,
            data.displayName,
            formatPortfolioGradeLabel(data.metadata),
          ),
          imageUrl: data.imageUrl,
          grade: formatPortfolioGradeLabel(data.metadata),
          certNumber: certNumberFromMetadata(data.metadata),
          vaultLabel: data.vaultLabel,
        },
      ],
    });
    router.push("/portfolio/redeem");
  };

  const listIdentity = listPriceSheetIdentity(
    data.metadata,
    tokenId,
    data.displayName,
  );

  const listedPriceUsd = data.listing?.priceUsd ?? null;
  const existingAskOrderHash = data.listing?.orderHash ?? null;
  const existingAskOrder = data.listing?.order ?? null;

  const afterListingChange = useCallback(() => {
    void invalidateAfterListing(queryClient, {
      collectionKey,
      address: data.walletAddress,
      tokenId,
    });
    void queryClient.invalidateQueries({ queryKey: rq.orderByToken(tokenId) });
  }, [collectionKey, data.walletAddress, queryClient, tokenId]);

  return (
    <>
      <PortfolioCertificateView
        tokenId={tokenId}
        tokenIdOk={tokenIdOk}
        data={data}
        backHref={backHref}
        onRedeem={startRedeem}
        onSellList={() => setListOpen(true)}
      />
      {listOpen && tokenIdOk ? (
        <ListRwaModal
          tokenId={tokenId}
          assetTitle={listIdentity.line1}
          headlineParts={listIdentity.parts}
          headlineGrade={listIdentity.grade}
          collectionKey={collectionKey}
          collectionBids={bidsQuery.data?.collectionBids ?? []}
          shell="sheet"
          copyVariant="set-price"
          marketValueUsd={data.marketUsd}
          listedPriceUsd={listedPriceUsd}
          existingAskOrder={existingAskOrder ?? undefined}
          existingAskOrderHash={existingAskOrderHash}
          initialPriceUsdc={
            listedPriceUsd != null ? String(listedPriceUsd) : null
          }
          onRequestCancelListing={
            existingAskOrderHash
              ? () => {
                  setListOpen(false);
                  setCancelListingConfirm({
                    orderHash: existingAskOrderHash,
                    listPriceUsd: listedPriceUsd,
                  });
                }
              : undefined
          }
          onClose={() => setListOpen(false)}
          onMatchedSale={afterListingChange}
          onListed={afterListingChange}
        />
      ) : null}
      {cancelListingConfirm != null ? (
        <PortfolioCancelListingConfirmModal
          open
          assetTitle={listIdentity.line1}
          gradeLabel={listIdentity.grade}
          listPriceUsd={cancelListingConfirm.listPriceUsd}
          pending={holdingActions.cancellingListingTokenId === tokenId}
          onClose={() => setCancelListingConfirm(null)}
          onConfirm={async () => {
            await holdingActions.cancelListing(
              tokenId,
              cancelListingConfirm.orderHash,
              cancelListingConfirm.listPriceUsd ?? undefined,
            );
            setCancelListingConfirm(null);
            afterListingChange();
          }}
        />
      ) : null}
    </>
  );
}
