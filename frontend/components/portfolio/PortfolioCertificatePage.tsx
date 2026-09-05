"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ListRwaModal } from "@/components/marketplace/list-rwa/ListRwaModal";
import { PortfolioCertificateView } from "@/components/portfolio/PortfolioCertificateView";
import { usePortfolioCertificate } from "@/hooks/portfolio/usePortfolioCertificate";
import { useAppChain } from "@/providers/AppChainProvider";
import {
  certNumberFromMetadata,
  writeRedeemDraft,
} from "@/lib/portfolio/redeemDraft";
import { formatPortfolioGradeLabel } from "@/lib/portfolio/portfolioAssetMeta";
import { formatRedeemCardLine1FromMetadata, listPriceSheetIdentity } from "@/lib/portfolio/portfolioTableHelpers";
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
  const raw = params.tokenId;
  const tokenId = Number(Array.isArray(raw) ? raw[0] : raw);
  const tokenIdOk = Number.isFinite(tokenId) && tokenId >= 0;
  const backHref = variant === "partner" ? PARTNER_PORTFOLIO_PATH : PORTFOLIO_PATH;
  const data = usePortfolioCertificate(tokenId, tokenIdOk);
  const { chainId } = useAppChain();
  const [listOpen, setListOpen] = useState(false);

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
          collectionKey={data.collectionKey}
          shell="sheet"
          copyVariant="set-price"
          marketValueUsd={data.marketUsd}
          listedPriceUsd={data.listing?.priceUsd ?? null}
          existingAskOrderHash={data.listing?.orderHash ?? null}
          onClose={() => setListOpen(false)}
          onListed={() => setListOpen(false)}
        />
      ) : null}
    </>
  );
}
