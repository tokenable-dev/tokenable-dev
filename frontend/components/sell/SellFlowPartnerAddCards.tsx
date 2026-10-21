"use client";

import { useEffect, useMemo, useState } from "react";
import { useEnsureAccountWalletReady } from "@/hooks/auth/useEnsureAccountWalletReady";
import { useAccessGate } from "@/hooks/auth/useAccessGate";
import { mintSealedBox } from "@/lib/sell/sealedBoxMint";
import { SLAB_UPLOAD_ACCEPT } from "@/lib/vault/mintImageSource";
import { useAppChain } from "@/providers/AppChainProvider";
import { TkButton } from "@/components/ds";
import {
  searchCatalogProducts,
  searchCatalogUpc,
  type CatalogProductHit,
} from "@/lib/core/api/pricecharting-listings";
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
type ItemKind = "card" | "box";

function boxHitSubtitle(hit: CatalogProductHit): string {
  const year = hit.releaseDate?.slice(0, 4) ?? "";
  const set = hit.consoleName.trim();
  return [year, set].filter(Boolean).join(" · ");
}

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

  const [itemKind, setItemKind] = useState<ItemKind>("card");
  const [boxQuery, setBoxQuery] = useState("");
  const [boxHits, setBoxHits] = useState<CatalogProductHit[]>([]);
  const [boxMenuOpen, setBoxMenuOpen] = useState(false);
  const [boxSearchBusy, setBoxSearchBusy] = useState(false);
  const [boxSearchError, setBoxSearchError] = useState<string | null>(null);
  const [boxPick, setBoxPick] = useState<CatalogProductHit | null>(null);
  const [boxPhoto, setBoxPhoto] = useState<File | null>(null);
  const [boxPhotoUrl, setBoxPhotoUrl] = useState<string | null>(null);
  const [boxMintBusy, setBoxMintBusy] = useState(false);
  const [boxMintError, setBoxMintError] = useState<string | null>(null);
  const [boxMintedTokenId, setBoxMintedTokenId] = useState<string | null>(null);
  const { chainId } = useAppChain();
  const ensureAccountWalletReady = useEnsureAccountWalletReady();
  const { runAccessGate } = useAccessGate(1, "/sell/flow");
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

  const mintBox = async () => {
    if (!boxPick || !boxPhoto || boxMintBusy) return;
    if (!runAccessGate()) return;
    setBoxMintBusy(true);
    setBoxMintError(null);
    setBoxMintedTokenId(null);
    try {
      const recipientAddress = await ensureAccountWalletReady();
      const minted = await mintSealedBox({
        pricechartingProductId: boxPick.id,
        clientRequestId: crypto.randomUUID(),
        image: boxPhoto,
        chainId,
        recipientAddress,
      });
      setBoxMintedTokenId(minted.tokenId);
      setBoxPhoto(null);
      setBoxPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } catch (err) {
      setBoxMintError(err instanceof Error ? err.message : "Sealed box mint failed");
    } finally {
      setBoxMintBusy(false);
    }
  };

  const lookupBox = async () => {
    const q = boxQuery.trim();
    if (!q || boxSearchBusy) return;
    setBoxSearchBusy(true);
    setBoxSearchError(null);
    try {
      const hits = /^\d+$/.test(q)
        ? await searchCatalogUpc(q)
        : await searchCatalogProducts(q);
      setBoxHits(hits);
      setBoxMenuOpen(true);
    } catch (err) {
      setBoxHits([]);
      setBoxMenuOpen(false);
      setBoxSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBoxSearchBusy(false);
    }
  };

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
            disabled={mintBusy || csvLookupBusy || boxMintBusy}
          >
            <BackChevron />
            Back
          </button>

          <div className="sell-flow-eyebrow">Partner vault</div>
          <h1 className="sell-flow-h1">Enter item info</h1>

          <div className="sell-flow-kind" role="tablist" aria-label="Item type">
            <button
              type="button"
              role="tab"
              className={`sell-flow-kind__b${itemKind === "card" ? " sell-flow-kind__b--on" : ""}`}
              aria-selected={itemKind === "card"}
              disabled={mintBusy || boxMintBusy}
              onClick={() => setItemKind("card")}
            >
              Card
            </button>
            <button
              type="button"
              role="tab"
              className={`sell-flow-kind__b${itemKind === "box" ? " sell-flow-kind__b--on" : ""}`}
              aria-selected={itemKind === "box"}
              disabled={mintBusy || boxMintBusy}
              onClick={() => setItemKind("box")}
            >
              Sealed box
            </button>
          </div>

          <div className="sell-flow-glass sell-flow-glass--partner-input">
            {itemKind === "box" ? (
              <div role="tabpanel">
                <label className="sell-flow-cert-label" htmlFor="sell-flow-box-query">
                  Box name or barcode number
                </label>
                <div className="sell-flow-box-search">
                  <div className="sell-flow-cert-row">
                    <input
                      id="sell-flow-box-query"
                      className="sell-flow-cert-input sell-flow-box-input"
                      type="text"
                      autoComplete="off"
                      placeholder="e.g. Evolving Skies or 820650851100"
                      value={boxQuery}
                      disabled={mintBusy || boxSearchBusy || boxMintBusy}
                      onChange={(e) => {
                        setBoxQuery(e.target.value);
                        setBoxMenuOpen(false);
                        setBoxPick(null);
                        setBoxMintedTokenId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void lookupBox();
                        }
                      }}
                    />
                    <TkButton
                      type="button"
                      variant="primary"
                      className="sell-flow-lookup-btn"
                      disabled={mintBusy || boxSearchBusy || boxMintBusy || !boxQuery.trim()}
                      onClick={() => void lookupBox()}
                    >
                      {boxSearchBusy ? "Checking" : "Check"}
                    </TkButton>
                  </div>
                  {boxMenuOpen ? (
                    <ul className="sell-flow-box-menu" role="listbox" aria-label="Matching boxes">
                      {boxHits.length === 0 ? (
                        <li className="sell-flow-box-menu__empty">No boxes matched that text.</li>
                      ) : (
                        boxHits.map((hit) => (
                          <li key={hit.id}>
                            <button
                              type="button"
                              role="option"
                              className="sell-flow-box-menu__b"
                              onClick={() => {
                                setBoxPick(hit);
                                setBoxQuery(hit.productName);
                                setBoxMenuOpen(false);
                                setBoxMintError(null);
                                setBoxMintedTokenId(null);
                              }}
                            >
                              <span className="sell-flow-box-menu__name">{hit.productName}</span>
                              <span className="sell-flow-box-menu__sub">{boxHitSubtitle(hit)}</span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                </div>
                {boxPick ? (
                  <div className="sell-flow-box-after">
                    <p className="sell-flow-box-pick">
                      <span className="sell-flow-box-pick__name">{boxPick.productName}</span>
                      <span className="sell-flow-box-pick__sub">{boxHitSubtitle(boxPick)}</span>
                    </p>
                    <input
                      id="sell-flow-box-photo"
                      type="file"
                      accept={SLAB_UPLOAD_ACCEPT}
                      className="sr-only"
                      disabled={boxMintBusy}
                      onChange={(e) => {
                          const next = e.target.files?.[0] ?? null;
                          e.target.value = "";
                          if (!next) return;
                          const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
                          if (!allowed.includes(next.type)) {
                            setBoxMintError(
                              "Image must be JPEG, PNG, or WebP. HEIC and other formats are not supported — convert or re-export and try again.",
                            );
                            return;
                          }
                          if (next.size > 10 * 1024 * 1024) {
                            setBoxMintError("Image is too large after processing");
                            return;
                          }
                          setBoxMintError(null);
                          setBoxPhoto(next);
                          setBoxPhotoUrl((prev) => {
                            if (prev) URL.revokeObjectURL(prev);
                            return URL.createObjectURL(next);
                          });
                        }}
                    />
                    <TkButton
                      type="button"
                      variant="subtle"
                      className="sell-flow-scan-btn sell-flow-partner-btn--ghost sell-flow-partner-scan-slab sell-flow-box-photo"
                      disabled={boxMintBusy}
                      onClick={() => document.getElementById("sell-flow-box-photo")?.click()}
                    >
                      Upload photo
                    </TkButton>
                    {boxPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={boxPhotoUrl} alt="" className="sell-flow-box-photo-preview" />
                    ) : null}
                    <TkButton
                      type="button"
                      variant="primary"
                      className="sell-flow-ship-btn sell-flow-box-mint"
                      disabled={boxMintBusy || !boxPhoto}
                      onClick={() => void mintBox()}
                    >
                      {boxMintBusy ? "Minting…" : "Mint sealed box"}
                    </TkButton>
                    {boxMintedTokenId ? (
                      <p className="sell-flow-box-minted">Minted as token #{boxMintedTokenId}.</p>
                    ) : null}
                    {boxMintError ? (
                      <p className="sell-flow-partner-cert-error" role="alert">
                        {boxMintError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {boxSearchError ? (
                  <p className="sell-flow-partner-cert-error" role="alert">
                    {boxSearchError}
                  </p>
                ) : null}
              </div>
            ) : null}
            {itemKind === "card" ? (
            <>
            <div
              className="sell-flow-mseg sell-flow-mseg--text"
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
            </>
            ) : null}
          </div>

          {itemKind === "card" && addMode === "single" && cards.length > 0 ? (
            <div className="sell-flow-glass sell-flow-glass--partner-cards">
              <SellFlowYourCardsSection
                cards={cards}
                maxCards={maxCards}
                onRemove={removeCard}
              />
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
                    <>
                      Mint {cards.length}{" "}
                      {cards.length === 1 ? "card" : "cards"} to collection
                    </>
                  )}
                </TkButton>
              </div>
              {mintError ? (
                <p className="sell-flow-mint-error" role="alert">
                  {mintError}
                </p>
              ) : null}
            </div>
          ) : null}
          {itemKind === "card" && addMode === "single" ? (
            <SellFlowPartnerMintBackground
              visible={mintBusy && mintProgressHidden}
              done={mintProgress.done}
              total={mintProgress.total}
              onShow={() => setMintProgressHidden(false)}
            />
          ) : itemKind === "card" ? (
            <>
              <SellFlowPartnerCsvSection section="workspace" {...csvSectionProps} />
              <SellFlowPartnerMintBackground
                visible={mintBusy && mintProgressHidden}
                done={mintProgress.done}
                total={mintProgress.total}
                onShow={() => setMintProgressHidden(false)}
              />
            </>
          ) : null}
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
