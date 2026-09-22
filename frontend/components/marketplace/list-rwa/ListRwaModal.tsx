"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TkActionSheet } from "@/components/ds";
import {
  ListRwaModalFormActions,
  ListRwaModalFormView,
} from "@/components/marketplace/list-rwa/ListRwaModalFormView";
import { ListRwaModalSuccessView } from "@/components/marketplace/list-rwa/ListRwaModalSuccessView";
import { useListRwaModal } from "@/hooks/list-rwa";
import type { ListRwaModalProps } from "@/lib/seaport/listing/listRwaModalTypes";
import { formatUsdListing } from "@/lib/market/collectionMarketPricing";

export type { ListRwaModalProps } from "@/lib/seaport/listing/listRwaModalTypes";

type ListRwaModalController = ReturnType<typeof useListRwaModal>;

/** Hooks only — presentation is {@link ListRwaModalBody} (no hooks). */
export function ListRwaModal(props: ListRwaModalProps) {
  const open = props.open ?? true;
  const modal = useListRwaModal(props);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const shell = props.shell ?? "modal";
    if (!open || shell === "sheet" || modal.step === "success") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [props.shell, modal.step, open]);

  if (!open) return null;

  return <ListRwaModalBody {...props} modal={modal} mounted={mounted} />;
}

function ListRwaModalBody({
  tokenId,
  assetTitle,
  headlineParts,
  headlineGrade,
  collectionKey,
  onClose,
  shell = "modal",
  copyVariant = "default",
  marketValueUsd,
  listedPriceUsd,
  modal,
  mounted,
}: ListRwaModalProps & { modal: ListRwaModalController; mounted: boolean }) {
  const formVariant = shell === "sheet" ? "sheet" : "modal";
  const isSetPrice = copyVariant === "set-price";
  const isSuccess = modal.step === "success";
  const sheetLabel = isSetPrice
    ? modal.isReplaceListing
      ? "Edit price"
      : "Set price"
    : "List for sale";

  if (isSuccess) {
    const success = (
      <ListRwaModalSuccessView
        tokenId={tokenId}
        price={modal.price}
        isReplaceListing={modal.isReplaceListing}
        successMeta={modal.successMeta}
        copyVariant={copyVariant}
        settlementPolicy={modal.settlementPolicy}
        onClose={onClose}
      />
    );
    if (shell === "sheet") {
      return (
        <TkActionSheet open onClose={onClose} aria-label={sheetLabel}>
          {success}
        </TkActionSheet>
      );
    }
    return success;
  }

  const listPriceNum = Number(String(modal.price).replace(/[^0-9.]/g, ""));
  const topBidUsd = modal.topCollectionBid
    ? Number(modal.topCollectionBid.inputValue)
    : 0;
  const sellingNow =
    isSetPrice &&
    topBidUsd > 0 &&
    Number.isFinite(listPriceNum) &&
    listPriceNum > 0 &&
    listPriceNum <= topBidUsd &&
    modal.crossingBidsForInstantSale.length > 0;
  const ctaLabel = modal.isProcessing
    ? "Processing..."
    : sellingNow
      ? `Sell now — ${formatUsdListing(listPriceNum)}`
      : isSetPrice
        ? modal.isReplaceListing
          ? "Update"
          : "List"
        : modal.isReplaceListing
          ? "Update listing"
          : "List";

  const formProps = {
    tokenId,
    assetTitle,
    headlineParts,
    headlineGrade,
    collectionKey,
    isReplaceListing: modal.isReplaceListing,
    price: modal.price,
    onPriceChange: modal.setPrice,
    crossingBidsForInstantSale: modal.crossingBidsForInstantSale,
    selectedBidHash: modal.selectedBidHash,
    onSelectBidHash: modal.setSelectedBidHash,
    topCollectionBid: modal.topCollectionBid,
    marketValueUsd,
    listedPriceUsd,
    onClose,
    copyVariant,
    settlementPolicy: modal.settlementPolicy,
    vaultLabel: modal.vaultLabel,
    step: modal.step,
    errorMsg: modal.errorMsg,
    isProcessing: modal.isProcessing,
    onSubmit: () => void modal.handleList(),
    variant: formVariant as "modal" | "sheet",
  };

  const sheetActions = (
    <ListRwaModalFormActions
      ctaLabel={ctaLabel}
      sellingNow={sellingNow}
      isProcessing={modal.isProcessing}
      price={modal.price}
      onSubmit={() => void modal.handleList()}
      isSetPrice={isSetPrice}
      onClose={onClose}
    />
  );

  const form = (
    <ListRwaModalFormView
      {...formProps}
      hideActions={isSetPrice && shell === "sheet"}
    />
  );

  if (shell === "sheet") {
    return (
      <TkActionSheet
        open
        onClose={onClose}
        aria-label={sheetLabel}
        actions={isSetPrice ? sheetActions : undefined}
      >
        {form}
      </TkActionSheet>
    );
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-5 sm:px-6 sm:py-8">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative mx-auto flex w-full max-w-[min(100%,22rem)] flex-col rounded-2xl border border-zinc-700/90 bg-zinc-950 px-6 py-6 shadow-xl shadow-black/40 sm:py-8">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 rounded-lg p-1 text-sm text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200 sm:right-4 sm:top-4"
        >
          ✕
        </button>
        <ListRwaModalFormView {...formProps} />
      </div>
    </div>,
    document.body,
  );
}
