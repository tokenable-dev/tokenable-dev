"use client";

import type { MutableRefObject } from "react";
import type { Order } from "@/lib/core";
import { CriteriaBidFormActions } from "./CriteriaBidFormActions";
import { CriteriaBidFormHeader } from "./CriteriaBidFormHeader";
import { CriteriaBidFormPriceSection } from "./CriteriaBidFormPriceSection";
import type { CollectionCriteriaBidStep } from "./types";

export function CollectionCriteriaBidPanelForm({
  embedded,
  isModal = false,
  actionLayout = "combined",
  buyHelpTitle,
  balanceUsdc,
  lowestAsk,
  lowestAskUsdc,
  lowestAskCandidates,
  crossesBook,
  price,
  busy,
  walletSignerMissing,
  address,
  priceTouchedRef,
  setPrice,
  priceOk,
  enteredAboveBestAsk,
  enteredUsdcLabel,
  merkleLoading,
  merkleLeafTokenIds,
  merkleIsError,
  submitDisabled,
  busyLabel,
  errorMsg,
  step,
  lastOutcome,
  postBidMatchHint,
  onSubmit,
  onOpenSellModal,
  hideSellFooter = false,
  hideSubmitButton = false,
  headerTitle,
  isReplaceBid = false,
}: {
  embedded: boolean;
  isModal?: boolean;
  actionLayout?: import("./types").CollectionCriteriaBidActionLayout;
  buyHelpTitle: string;
  balanceUsdc: number | null;
  lowestAsk: Order | null;
  lowestAskUsdc: string | null;
  lowestAskCandidates: Order[];
  crossesBook: boolean;
  price: string;
  busy: boolean;
  walletSignerMissing: boolean;
  address: string | undefined;
  priceTouchedRef: MutableRefObject<boolean>;
  setPrice: (v: string) => void;
  priceOk: boolean;
  enteredAboveBestAsk: boolean;
  enteredUsdcLabel: string | null;
  merkleLoading: boolean;
  merkleLeafTokenIds: string[];
  merkleIsError: boolean;
  submitDisabled: boolean;
  busyLabel: string;
  errorMsg: string;
  step: CollectionCriteriaBidStep;
  lastOutcome: "instant" | "bid" | null;
  postBidMatchHint: string | null;
  onSubmit: () => void;
  onOpenSellModal?: () => void;
  hideSellFooter?: boolean;
  hideSubmitButton?: boolean;
  headerTitle?: string;
  isReplaceBid?: boolean;
}) {
  return (
    <>
      {!isModal ? (
        <CriteriaBidFormHeader
          embedded={embedded}
          buyHelpTitle={buyHelpTitle}
          title={headerTitle}
        />
      ) : null}
      <div
        className={
          isModal
            ? "space-y-4"
            : embedded
              ? "space-y-2 pt-2"
              : "space-y-4 px-4 py-4"
        }
      >
        <CriteriaBidFormPriceSection
          embedded={embedded}
          minimal={isModal}
          balanceUsdc={balanceUsdc}
          lowestAsk={lowestAsk}
          lowestAskUsdc={lowestAskUsdc}
          lowestAskCandidates={lowestAskCandidates}
          crossesBook={crossesBook}
          price={price}
          busy={busy}
          address={address}
          priceTouchedRef={priceTouchedRef}
          setPrice={setPrice}
          priceOk={priceOk}
          enteredAboveBestAsk={enteredAboveBestAsk}
          enteredUsdcLabel={enteredUsdcLabel}
          merkleLoading={merkleLoading}
          merkleLeafTokenIds={merkleLeafTokenIds}
          merkleIsError={merkleIsError}
        />
        {!hideSubmitButton ? (
          <CriteriaBidFormActions
            embedded={embedded}
            minimal={isModal}
            actionLayout={actionLayout}
            address={address}
            walletSignerMissing={walletSignerMissing}
            submitDisabled={submitDisabled}
            busy={busy}
            busyLabel={busyLabel}
            crossesBook={crossesBook}
            lowestAsk={lowestAsk}
            lowestAskUsdc={lowestAskUsdc}
            errorMsg={errorMsg}
            step={step}
            lastOutcome={lastOutcome}
            postBidMatchHint={postBidMatchHint}
            onSubmit={onSubmit}
            onOpenSellModal={onOpenSellModal}
            hideSellFooter={hideSellFooter}
            isReplaceBid={isReplaceBid}
          />
        ) : (
          <>
            {errorMsg ? (
              <p className={`text-rose-400/90 ${embedded ? "text-[10px]" : "text-[11px]"}`}>
                {errorMsg}
              </p>
            ) : null}
            {step === "success" ? (
              <p className={`text-mint/90 ${embedded ? "text-[10px]" : "text-[11px]"}`}>
                {lastOutcome === "instant"
                  ? "Purchase complete."
                  : isReplaceBid
                    ? "Bid updated."
                    : "Bid placed."}
              </p>
            ) : null}
            {step === "success" && lastOutcome === "bid" && postBidMatchHint ? (
              <p
                className={`text-amber-200/85 ${embedded ? "text-[10px] leading-snug" : "text-[11px] leading-snug"}`}
              >
                {postBidMatchHint}
              </p>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
