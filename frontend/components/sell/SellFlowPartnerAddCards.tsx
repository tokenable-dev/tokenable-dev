"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TkButton } from "@/components/ds";
import type { useSellFlow } from "@/hooks/sell/useSellFlow";
import { SellFlowCertDirectInput } from "./SellFlowCertDirectInput";
import { SellFlowCertProgress } from "./SellFlowCertProgress";
import {
  SellFlowPartnerCsvSection,
  type PartnerCsvRow,
} from "./SellFlowPartnerCsvSection";
import {
  SellFlowPartnerMintBackground,
  SellFlowPartnerMintModal,
} from "./SellFlowPartnerMintModal";
import { SellFlowPartnerSlabUpload } from "./SellFlowPartnerSlabUpload";
import { SellFlowYourCardsSection } from "./SellFlowYourCardsSection";

type Flow = ReturnType<typeof useSellFlow>;
type AddMode = "single" | "csv";

/** Partner-Add-Cards.html — partner vault bulk upload + mint. */
export function SellFlowPartnerAddCards({ flow }: { flow: Flow }) {
  const {
    cards,
    maxCards,
    certInput,
    setCertInput,
    certError,
    lookupBusy,
    mintBusy,
    mintError,
    mintStatus,
    slabInputRef,
    canContinueShipping,
    partnerMintSuccess,
    dismissPartnerMintResult,
    lookupCert,
    lookupCertByNumber,
    onSlabFile,
    uploadSlabPhotos,
    toggleConfirm,
    setAllConfirmed,
    removeCard,
    continueToSelfMint,
    goBackToVaultChoice,
    saveDraft,
    draftSavedFlash,
  } = flow;

  const [addMode, setAddMode] = useState<AddMode>("single");
  const [csvRows, setCsvRows] = useState<PartnerCsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);
  const [csvLookupBusy, setCsvLookupBusy] = useState(false);
  const [mintProgressHidden, setMintProgressHidden] = useState(false);

  useEffect(() => {
    if (mintBusy) setMintProgressHidden(false);
  }, [mintBusy]);

  const busy = lookupBusy || mintBusy || csvLookupBusy;
  const allConfirmed = cards.length > 0 && cards.every((c) => c.confirmed);
  const confirmedCount = cards.filter((c) => c.confirmed).length;

  const csvCanMint = useMemo(() => {
    if (addMode !== "csv") return false;
    if (csvLookupBusy) return false;
    if (csvRows.some((r) => r.status === "looking")) return false;
    return canContinueShipping && confirmedCount > 0;
  }, [addMode, canContinueShipping, confirmedCount, csvLookupBusy, csvRows]);

  const mintTotal = confirmedCount;

  const mintProgress = useMemo(() => {
    if (!mintBusy || !mintStatus) return { done: 0, total: mintTotal };
    const m = mintStatus.match(/Minting (\d+)\/(\d+)/);
    if (!m) return { done: 0, total: mintTotal };
    return { done: Number(m[1]), total: Number(m[2]) };
  }, [mintBusy, mintStatus, mintTotal]);

  const registerLabel = useMemo(() => {
    const n = confirmedCount || cards.length;
    if (!n) return "Add to my vault";
    return `Add ${n} card${n === 1 ? "" : "s"} to my vault`;
  }, [cards.length, confirmedCount]);

  const removeCertFromList = (cert: string) => {
    const i = cards.findIndex((c) => c.cert === cert);
    if (i >= 0) removeCard(i);
  };

  const csvSectionProps = {
    maxCards,
    cards,
    csvRows,
    onCsvRowsChange: setCsvRows,
    csvFileName,
    onCsvFileNameChange: setCsvFileName,
    csvParseError,
    onCsvParseErrorChange: setCsvParseError,
    csvLookupBusy,
    onCsvLookupBusyChange: setCsvLookupBusy,
    lookupCertByNumber,
    mintBusy,
    mintError,
    canMint: csvCanMint,
    onMint: () => void continueToSelfMint(),
    onSaveDraft: () => saveDraft(),
    draftSavedFlash,
    onRemoveCert: removeCertFromList,
  };

  return (
    <>
      <section className="sell-flow-screen sell-flow-screen--partner">
        <div className="sell-flow-col sell-flow-col--partner">
          <nav
            className="sell-flow-partner-crumb sell-ship-crumb"
            aria-label="Breadcrumb"
          >
            <Link href="/sell">Sell</Link>
            <span className="sell-ship-crumb__sep" aria-hidden>/</span>
            <button
              type="button"
              className="sell-flow-partner-crumb__mid"
              onClick={goBackToVaultChoice}
            >
              Choose a vault
            </button>
            <span className="sell-ship-crumb__sep" aria-hidden>/</span>
            <span className="sell-flow-partner-crumb__here">Partner vault</span>
          </nav>

          <div className="sell-flow-eyebrow">Partner vault</div>
          <h1 className="sell-flow-h1">Add your cards</h1>

          <div className="sell-flow-glass sell-flow-glass--partner-input">
            <div
              className="sell-flow-mseg"
              role="tablist"
              aria-label="How to add cards"
            >
              <button
                type="button"
                role="tab"
                className={`sell-flow-mseg__b${addMode === "single" ? " sell-flow-mseg__b--on" : ""}`}
                aria-selected={addMode === "single"}
                disabled={mintBusy}
                onClick={() => setAddMode("single")}
              >
                Add individually
              </button>
              <button
                type="button"
                role="tab"
                className={`sell-flow-mseg__b${addMode === "csv" ? " sell-flow-mseg__b--on" : ""}`}
                aria-selected={addMode === "csv"}
                disabled={mintBusy}
                onClick={() => setAddMode("csv")}
              >
                Upload CSV
              </button>
            </div>

            {addMode === "single" ? (
              <div role="tabpanel">
                <SellFlowPartnerSlabUpload
                  maxCards={maxCards}
                  cardCount={cards.length}
                  disabled={busy}
                  inputRef={slabInputRef}
                  onSingleSlab={async (file) => {
                    await onSlabFile(file);
                  }}
                  uploadSlabPhotos={uploadSlabPhotos}
                />

                <SellFlowCertDirectInput
                  value={certInput}
                  onChange={setCertInput}
                  onLookup={() => void lookupCert()}
                  busy={busy}
                  error={certError}
                  partner
                />

                <SellFlowCertProgress active={lookupBusy} tone="light" />
                {certError && addMode === "single" ? (
                  <p className="sell-flow-partner-cert-error" id="cert-error" role="alert">
                    {certError}
                  </p>
                ) : null}
              </div>
            ) : (
              <SellFlowPartnerCsvSection section="picker" {...csvSectionProps} />
            )}
          </div>

          {addMode === "single" ? (
            <>
              <SellFlowYourCardsSection
                variant="partner"
                cards={cards}
                maxCards={maxCards}
                allConfirmed={allConfirmed}
                onToggleConfirm={toggleConfirm}
                onToggleAllConfirmed={setAllConfirmed}
                onRemove={removeCard}
                allowCertDirectInput
              />

              {mintError ? (
                <p className="sell-flow-mint-error" role="alert">
                  {mintError}
                </p>
              ) : null}

              <div className="sell-flow-partner-cta sell-flow-partner-cta--single">
                <TkButton
                  type="button"
                  variant="subtle"
                  className="sell-flow-partner-back sell-flow-partner-btn--ghost"
                  disabled={mintBusy}
                  onClick={goBackToVaultChoice}
                >
                  Back
                </TkButton>
                <TkButton
                  type="button"
                  variant="primary"
                  className="sell-flow-partner-register sell-flow-partner-btn--primary"
                  disabled={!canContinueShipping || mintBusy}
                  onClick={() => void continueToSelfMint()}
                >
                  {mintBusy ? (
                    <>
                      <span className="sell-flow-spinner" aria-hidden /> Minting…
                    </>
                  ) : (
                    registerLabel
                  )}
                </TkButton>
              </div>
              <SellFlowPartnerMintBackground
                visible={mintBusy && mintProgressHidden}
                done={mintProgress.done}
                total={mintProgress.total}
                onShow={() => setMintProgressHidden(false)}
              />

              <p className="sell-flow-partner-footnote">
                Cards appear in your collection right away. Set prices there to put them up for sale.
              </p>
            </>
          ) : (
            <>
              <SellFlowPartnerCsvSection section="workspace" {...csvSectionProps} />
              <SellFlowPartnerMintBackground
                visible={mintBusy && mintProgressHidden}
                done={mintProgress.done}
                total={mintProgress.total}
                onShow={() => setMintProgressHidden(false)}
              />
            </>
          )}
        </div>
      </section>

      <SellFlowPartnerMintModal
        mintBusy={mintBusy}
        done={mintProgress.done}
        total={mintProgress.total}
        progressHidden={mintProgressHidden}
        onProgressHiddenChange={setMintProgressHidden}
        result={partnerMintSuccess}
        onDismissResult={dismissPartnerMintResult}
        onRetryFailed={() => void continueToSelfMint()}
      />
    </>
  );
}
