"use client";

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

function BackChevron() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

/** Choose-Vault-Individual.html partner path + CSV bulk (Partner-Add-Cards). */
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
    removeCard,
    continueToSelfMint,
    goBackToVaultChoice,
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
    onRemoveCert: removeCertFromList,
  };

  return (
    <>
      <section className="sell-flow-screen sell-flow-screen--partner">
        <div className="sell-flow-col sell-flow-col--partner">
          <button
            type="button"
            className="sell-flow-btn-back"
            onClick={goBackToVaultChoice}
            disabled={mintBusy || csvLookupBusy}
          >
            <BackChevron />
            Back
          </button>

          <div className="sell-flow-eyebrow">Partner vault</div>
          <h1 className="sell-flow-h1">Enter card info</h1>

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

                <SellFlowYourCardsSection
                  cards={cards}
                  maxCards={maxCards}
                  onRemove={removeCard}
                  embedded
                />

                {cards.length > 0 ? (
                  <div className="sell-flow-cards-cta">
                    <TkButton
                      type="button"
                      variant="primary"
                      className="sell-flow-ship-btn"
                      disabled={!canContinueShipping || mintBusy}
                      onClick={() => void continueToSelfMint()}
                    >
                      {mintBusy ? (
                        <>
                          <span className="sell-flow-spinner" aria-hidden /> Minting…
                        </>
                      ) : (
                        <>Mint to collection</>
                      )}
                    </TkButton>
                  </div>
                ) : null}
              </div>
            ) : (
              <SellFlowPartnerCsvSection section="picker" {...csvSectionProps} />
            )}
          </div>

          {addMode === "single" ? (
            <>
              {mintError ? (
                <p className="sell-flow-mint-error" role="alert">
                  {mintError}
                </p>
              ) : null}
              <SellFlowPartnerMintBackground
                visible={mintBusy && mintProgressHidden}
                done={mintProgress.done}
                total={mintProgress.total}
                onShow={() => setMintProgressHidden(false)}
              />
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
