"use client";

import type { MutableRefObject } from "react";
import type { Order } from "@/lib/core";
import { CriteriaBidFormActions } from "./CriteriaBidFormActions";
import { CriteriaBidFormHeader } from "./CriteriaBidFormHeader";
import { CriteriaBidFormPriceSection } from "./CriteriaBidFormPriceSection";
import type { CollectionCriteriaBidStep } from "./types";

export function CollectionCriteriaBidPanelForm({
  embedded,
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
}: {
  embedded: boolean;
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
}) {
  return (
    <>
      <CriteriaBidFormHeader embedded={embedded} buyHelpTitle={buyHelpTitle} />
      <div className={`${embedded ? "space-y-2 pt-2" : "space-y-4 px-4 py-4"}`}>
        <CriteriaBidFormPriceSection
          embedded={embedded}
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
        <CriteriaBidFormActions
          embedded={embedded}
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
        />
      </div>
    </>
  );
}
