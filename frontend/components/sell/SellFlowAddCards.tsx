"use client";

import { useMemo, useState } from "react";
import { TkButton } from "@/components/ds";
import type { useSellFlow } from "@/hooks/sell/useSellFlow";
import { SellFlowCertDirectInput } from "./SellFlowCertDirectInput";
import { SellFlowCertProgress } from "./SellFlowCertProgress";
import {
  SellFlowPartnerCsvSection,
  type PartnerCsvRow,
} from "./SellFlowPartnerCsvSection";
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

/** PSA vault add-cards — same Add individually / Upload CSV chrome as Partner. */
export function SellFlowAddCards({ flow }: { flow: Flow }) {
  const {
    cards,
    maxCards,
    showCertDirectInput,
    certInput,
    setCertInput,
    certError,
    lookupBusy,
    mintBusy,
    slabInputRef,
    canContinueShipping,
    lookupCert,
    lookupCertByNumber,
    onSlabFile,
    uploadSlabPhotos,
    removeCard,
    continueToShipping,
    goBackToVaultChoice,
  } = flow;

  const [addMode, setAddMode] = useState<AddMode>("single");
  const [csvRows, setCsvRows] = useState<PartnerCsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);
  const [csvLookupBusy, setCsvLookupBusy] = useState(false);

  const busy = lookupBusy || mintBusy || csvLookupBusy;
  const confirmedCount = cards.filter((c) => c.confirmed).length;

  const csvCanContinue = useMemo(() => {
    if (addMode !== "csv") return false;
    if (csvLookupBusy) return false;
    if (csvRows.some((r) => r.status === "looking")) return false;
    return canContinueShipping && confirmedCount > 0;
  }, [addMode, canContinueShipping, confirmedCount, csvLookupBusy, csvRows]);

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
    mintBusy: false,
    mintError: null as string | null,
    canMint: csvCanContinue,
    onMint: () => void continueToShipping(),
    onRemoveCert: removeCertFromList,
    submitKind: "continue" as const,
  };

  return (
    <section className="sell-flow-screen">
      <div className="sell-flow-col sell-flow-col--narrow">
        <button
          type="button"
          className="sell-flow-btn-back"
          onClick={goBackToVaultChoice}
          disabled={mintBusy || csvLookupBusy}
        >
          <BackChevron />
          Back
        </button>

        <div className="sell-flow-eyebrow">PSA Vault</div>
        <h1 className="sell-flow-h1">Enter card info</h1>

        <div className="sell-flow-glass sell-flow-glass--cards-input sell-flow-glass--partner-input">
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
              disabled={csvLookupBusy}
              onClick={() => setAddMode("single")}
            >
              Add individually
            </button>
            <button
              type="button"
              role="tab"
              className={`sell-flow-mseg__b${addMode === "csv" ? " sell-flow-mseg__b--on" : ""}`}
              aria-selected={addMode === "csv"}
              disabled={csvLookupBusy}
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

              {showCertDirectInput ? (
                <SellFlowCertDirectInput
                  value={certInput}
                  onChange={setCertInput}
                  onLookup={() => void lookupCert()}
                  busy={busy}
                  error={certError}
                  partner
                />
              ) : null}

              <SellFlowCertProgress active={lookupBusy} tone="light" />
              {certError && addMode === "single" ? (
                <p className="sell-flow-cert-error" id="cert-error" role="alert">
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
                    onClick={() => void continueToShipping()}
                  >
                    Continue
                  </TkButton>
                </div>
              ) : null}
            </div>
          ) : (
            <SellFlowPartnerCsvSection section="picker" {...csvSectionProps} />
          )}
        </div>

        {addMode === "csv" ? (
          <SellFlowPartnerCsvSection section="workspace" {...csvSectionProps} />
        ) : null}
      </div>
    </section>
  );
}
