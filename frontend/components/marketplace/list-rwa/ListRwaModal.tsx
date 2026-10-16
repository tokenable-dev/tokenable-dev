"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TkActionSheet } from "@/components/ds";
import { guardCloseWhileBusy } from "@/components/common/OpenGatedMount";
import { cn } from "@/lib/ds/cn";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
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

function DialogCloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ListRwaModal(props: ListRwaModalProps) {
  const open = props.open ?? true;
  return <ListRwaModalInner {...props} open={open} />;
}

/**
 * Wallet + listing hooks always run while this component is mounted (parent unmounts on close).
 * Do not return before hooks — `open` only gates the visible UI.
 */
function ListRwaModalInner(props: ListRwaModalProps & { open: boolean }) {
  const { onClose, shell = "modal", open, ...rest } = props;
  const modal = useListRwaModal(props);
  const mounted = useClientMounted();
  const [showSuccessUi, setShowSuccessUi] = useState(false);

  useEffect(() => {
    if (modal.step === "success") setShowSuccessUi(true);
  }, [modal.step]);

  useEffect(() => {
    if (shell === "sheet" || modal.step === "success" || showSuccessUi) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [shell, modal.step, showSuccessUi]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <ListRwaModalBody
      {...rest}
      shell={shell}
      onClose={handleClose}
      modal={modal}
      mounted={mounted}
      showSuccessUi={showSuccessUi}
    />
  );
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
  showSuccessUi,
}: ListRwaModalProps & {
  modal: ListRwaModalController;
  mounted: boolean;
  showSuccessUi: boolean;
}) {
  const formVariant = shell === "sheet" ? "sheet" : "modal";
  const isSetPrice = copyVariant === "set-price";
  const isSuccess = showSuccessUi;
  const requestClose = guardCloseWhileBusy(modal.isProcessing, onClose);

  useEffect(() => {
    if (shell !== "modal") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shell, requestClose]);

  const sheetLabel = isSetPrice
    ? modal.isReplaceListing
      ? "Edit price"
      : "Set price"
    : "List for sale";

  if (isSuccess) {
    return (
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
    onClose: requestClose,
    copyVariant,
    settlementPolicy: modal.settlementPolicy,
    vaultLabel: modal.vaultLabel,
    step: modal.step,
    errorMsg: modal.errorMsg,
    isProcessing: modal.isProcessing,
    onSubmit: () => void modal.handleList(),
    variant: formVariant as "modal" | "sheet",
  };

  const form = (
    <ListRwaModalFormView
      {...formProps}
      hideActions={false}
    />
  );

  if (shell === "sheet" && !isSetPrice) {
    return (
      <TkActionSheet
        open
        onClose={requestClose}
        aria-label={sheetLabel}
        actions={undefined}
      >
        {form}
      </TkActionSheet>
    );
  }

  if (!mounted) return null;

  const dialogLabel = isSetPrice ? sheetLabel : "List for sale";

  if (isSetPrice) {
    return createPortal(
      <div
        className="tk-set-price-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) requestClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={dialogLabel}
          className="tk-set-price-modal"
          data-open=""
          onClick={(e) => e.stopPropagation()}
        >
          <div className="tk-set-price-modal__handle" aria-hidden />
          <div className="tk-set-price-modal__content">
            <button
              type="button"
              className="tk-set-price-modal__close"
              onClick={requestClose}
              aria-label="Close"
              disabled={modal.isProcessing}
            >
              <span aria-hidden>×</span>
            </button>
            <ListRwaModalFormView {...formProps} hideActions />
          </div>
          <div className="tk-set-price-modal__actions">
            <ListRwaModalFormActions
              ctaLabel={ctaLabel}
              sellingNow={sellingNow}
              isProcessing={modal.isProcessing}
              price={modal.price}
              onSubmit={() => void modal.handleList()}
              isSetPrice
              onClose={requestClose}
            />
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className="tk-dialog__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
        className={cn("tk-dialog tk-list-rwa-dialog")}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="tk-dialog__close"
          onClick={requestClose}
          aria-label="Close"
          disabled={modal.isProcessing}
        >
          <DialogCloseIcon />
        </button>
        <ListRwaModalFormView {...formProps} />
      </div>
    </div>,
    document.body,
  );
}
