"use client";

import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";
import { useCollectionCriteriaBid } from "@/hooks/collection-criteria-bid";
import { CollectionCriteriaBidFloorChooserModal } from "./CollectionCriteriaBidFloorChooserModal";
import { CollectionCriteriaBidPanelForm } from "./CollectionCriteriaBidPanelForm";
import type { CollectionCriteriaBidPanelProps } from "./types";

export type { CollectionCriteriaBidPanelProps, CollectionCriteriaBidStep } from "./types";

export function CollectionCriteriaBidPanel({
  collectionKey,
  activeAsks = [],
  connectedAddress,
  onPlaced,
  onInstantBuyFillUsdc,
  onOpenSellModal,
  presetPriceFromBook,
  variant = "card",
  onPurchaseFilled,
}: CollectionCriteriaBidPanelProps) {
  const embedded = variant === "embedded";
  const bid = useCollectionCriteriaBid({
    collectionKey,
    activeAsks,
    connectedAddress,
    presetPriceFromBook,
    onPlaced,
    onInstantBuyFillUsdc,
    onPurchaseFilled,
  });

  const showFloorChooser =
    bid.showAskChooserModal && bid.crossesBook && bid.lowestAskCandidates.length >= 2;

  return (
    <div
      className={
        embedded
          ? "min-w-0 overflow-x-hidden overflow-y-visible"
          : `rounded-2xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} overflow-hidden shadow-[0_12px_32px_-16px_rgba(0,0,0,0.55)]`
      }
    >
      <CollectionCriteriaBidPanelForm
        embedded={embedded}
        buyHelpTitle={bid.buyHelpTitle}
        balanceUsdc={bid.balanceUsdc}
        lowestAsk={bid.lowestAsk}
        lowestAskUsdc={bid.lowestAskUsdc}
        lowestAskCandidates={bid.lowestAskCandidates}
        crossesBook={bid.crossesBook}
        price={bid.price}
        busy={bid.busy}
        walletSignerMissing={bid.walletSignerMissing}
        address={bid.address}
        priceTouchedRef={bid.priceTouchedRef}
        setPrice={bid.setPrice}
        priceOk={bid.priceOk}
        enteredAboveBestAsk={bid.enteredAboveBestAsk}
        enteredUsdcLabel={bid.enteredUsdcLabel}
        merkleLoading={bid.merkleLoading}
        merkleLeafTokenIds={bid.merkleLeafTokenIds}
        merkleIsError={bid.merkleIsError}
        submitDisabled={bid.submitDisabled}
        busyLabel={bid.busyLabel}
        errorMsg={bid.errorMsg}
        step={bid.step}
        lastOutcome={bid.lastOutcome}
        postBidMatchHint={bid.postBidMatchHint}
        onSubmit={() => void bid.handleSubmit()}
        onOpenSellModal={onOpenSellModal}
      />

      <CollectionCriteriaBidFloorChooserModal
        open={showFloorChooser}
        lowestAskCandidates={bid.lowestAskCandidates}
        lowestAsk={bid.lowestAsk}
        lowestAskUsdc={bid.lowestAskUsdc}
        floorMetaByTokenId={bid.floorMetaByTokenId}
        busy={bid.busy}
        onClose={() => bid.setShowAskChooserModal(false)}
        onSelectAskHash={bid.setSelectedFloorAskHash}
        onConfirmBuy={() => void bid.handleSubmit()}
      />
    </div>
  );
}
