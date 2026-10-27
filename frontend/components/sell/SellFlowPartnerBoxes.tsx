"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TkButton } from "@/components/ds";
import { useAccessGate } from "@/hooks/auth/useAccessGate";
import { useEnsureAccountWalletReady } from "@/hooks/auth/useEnsureAccountWalletReady";
import {
  searchCatalogProducts,
  searchCatalogUpc,
  type CatalogProductHit,
} from "@/lib/core/api/pricecharting-listings";
import { mintSealedBox } from "@/lib/core/api/rwa-mint";
import { invalidateAfterRwaMintTx } from "@/lib/core/invalidation";
import type { PartnerMintBatchResult } from "@/lib/sell/mintSellFlowCard";
import { classifyPartnerMintSkip } from "@/lib/sell/mintSellFlowCard";
import { SLAB_UPLOAD_ACCEPT } from "@/lib/vault/mintImageSource";
import { useAppChain } from "@/providers/AppChainProvider";
import {
  SellFlowPartnerMintBackground,
  SellFlowPartnerMintModal,
} from "./SellFlowPartnerMintModal";

type BoxDraft = {
  localId: string;
  clientRequestId: string;
  product: CatalogProductHit;
  photo: File | null;
  photoUrl: string | null;
  /** This draft only. Does not change the admin catalog cover. */
  coverDismissed: boolean;
};

function boxImageReady(box: BoxDraft): boolean {
  return Boolean(box.photo) || (!box.coverDismissed && Boolean(box.product.coverImageUrl));
}

function draftFromProduct(hit: CatalogProductHit): BoxDraft {
  return {
    localId: crypto.randomUUID(),
    clientRequestId: crypto.randomUUID(),
    product: hit,
    photo: null,
    photoUrl: null,
    coverDismissed: false,
  };
}

const BOX_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

function boxHitSubtitle(hit: CatalogProductHit): string {
  const year = hit.releaseDate?.slice(0, 4) ?? "";
  const set = hit.consoleName.trim();
  return [year, set].filter(Boolean).join(" · ");
}

/** Sealed-box search, local photos, and mint. Photos stay in the browser until Mint. */
export function SellFlowPartnerBoxes({
  otherBusy,
  onBusyChange,
}: {
  otherBusy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [boxQuery, setBoxQuery] = useState("");
  const [boxHits, setBoxHits] = useState<CatalogProductHit[]>([]);
  const [boxMenuOpen, setBoxMenuOpen] = useState(false);
  const [boxSearchBusy, setBoxSearchBusy] = useState(false);
  const [boxSearchError, setBoxSearchError] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<BoxDraft[]>([]);
  const [boxMintBusy, setBoxMintBusy] = useState(false);
  const [boxMintError, setBoxMintError] = useState<string | null>(null);
  const [mintDone, setMintDone] = useState(0);
  const [mintTotal, setMintTotal] = useState(0);
  const [mintProgressHidden, setMintProgressHidden] = useState(false);
  const [mintResult, setMintResult] = useState<PartnerMintBatchResult | null>(
    null,
  );
  const queryClient = useQueryClient();
  const boxPhotoInputRef = useRef<HTMLInputElement>(null);
  const boxPhotoTargetRef = useRef<string | null>(null);
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;
  const { chainId } = useAppChain();
  const ensureAccountWalletReady = useEnsureAccountWalletReady();
  const { runAccessGate } = useAccessGate(1, "/sell/flow");

  useEffect(() => {
    onBusyChange(boxMintBusy);
  }, [boxMintBusy, onBusyChange]);

  useEffect(() => {
    if (boxMintBusy) setMintProgressHidden(false);
  }, [boxMintBusy]);

  useEffect(() => {
    return () => {
      for (const box of boxesRef.current) {
        if (box.photoUrl) URL.revokeObjectURL(box.photoUrl);
      }
    };
  }, []);

  const boxesReady = boxes.filter(boxImageReady);
  const boxesMissingPhoto = boxes.length - boxesReady.length;
  const locked = otherBusy || boxSearchBusy || boxMintBusy;

  const addBox = (hit: CatalogProductHit) => {
    setBoxes((prev) => [
      ...prev,
      draftFromProduct(hit),
    ]);
    setBoxQuery("");
    setBoxMenuOpen(false);
    setBoxHits([]);
    setBoxMintError(null);
  };

  const removeBox = (localId: string) => {
    setBoxes((prev) => {
      const row = prev.find((box) => box.localId === localId);
      if (row?.photoUrl) URL.revokeObjectURL(row.photoUrl);
      return prev.filter((box) => box.localId !== localId);
    });
  };

  const attachBoxPhoto = (localId: string, file: File) => {
    if (!BOX_IMAGE_TYPES.includes(file.type)) {
      setBoxMintError(
        "Image must be JPEG, PNG, or WebP. HEIC and other formats are not supported — convert or re-export and try again.",
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setBoxMintError("Image is too large after processing");
      return;
    }
    setBoxMintError(null);
    const photoUrl = URL.createObjectURL(file);
    setBoxes((prev) =>
      prev.map((box) => {
        if (box.localId !== localId) return box;
        if (box.photoUrl) URL.revokeObjectURL(box.photoUrl);
        return { ...box, photo: file, photoUrl };
      }),
    );
  };

  const clearBoxImage = (localId: string) => {
    setBoxes((prev) =>
      prev.map((box) => {
        if (box.localId !== localId) return box;
        if (box.photoUrl) URL.revokeObjectURL(box.photoUrl);
        return { ...box, photo: null, photoUrl: null, coverDismissed: true };
      }),
    );
    setBoxMintError(null);
  };

  const mintBoxes = async () => {
    const ready = boxes.filter(boxImageReady);
    if (ready.length === 0 || boxMintBusy) return;
    if (!runAccessGate()) return;
    setBoxMintBusy(true);
    setBoxMintError(null);
    setMintResult(null);
    setMintDone(0);
    setMintTotal(ready.length);
    setMintProgressHidden(false);
    const succeeded: PartnerMintBatchResult["succeeded"] = [];
    const skipped: PartnerMintBatchResult["skipped"] = [];
    try {
      const recipientAddress = await ensureAccountWalletReady();
      let done = 0;
      for (const box of ready) {
        try {
          const minted = await mintSealedBox({
            pricechartingProductId: box.product.id,
            clientRequestId: box.clientRequestId,
            image: box.photo,
            chainId,
            recipientAddress,
          });
          const tokenId = Number(minted.tokenId);
          if (Number.isFinite(tokenId) && tokenId >= 1) {
            succeeded.push({
              cert: box.product.id,
              name: box.product.productName,
              tokenId,
            });
            try {
              await invalidateAfterRwaMintTx(queryClient, {
                tokenId,
                address: recipientAddress,
              });
            } catch {
              // The NFT is already minted. Portfolio refresh can fail without undoing it.
            }
          } else {
            skipped.push({
              cert: box.product.id,
              name: box.product.productName,
              kind: "other",
              title: "Mint returned an invalid token id",
              detail: String(minted.tokenId ?? ""),
            });
          }
          setBoxes((prev) => {
            const row = prev.find((item) => item.localId === box.localId);
            if (row?.photoUrl) URL.revokeObjectURL(row.photoUrl);
            return prev.filter((item) => item.localId !== box.localId);
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Sealed box mint failed";
          const classified = classifyPartnerMintSkip(message);
          skipped.push({
            cert: box.product.id,
            name: box.product.productName,
            kind: classified.kind,
            title: classified.title,
            detail: message,
          });
        }
        done += 1;
        setMintDone(done);
      }
      setMintResult({ succeeded, skipped });
    } catch (err) {
      setBoxMintError(
        err instanceof Error ? err.message : "Sealed box mint failed",
      );
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

  return (
    <>
      <div className="sell-flow-glass sell-flow-glass--partner-input">
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
                disabled={locked}
                onChange={(e) => {
                  setBoxQuery(e.target.value);
                  setBoxMenuOpen(false);
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
                disabled={locked || !boxQuery.trim()}
                onClick={() => void lookupBox()}
              >
                {boxSearchBusy ? "Looking up" : "Look up"}
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
                        onClick={() => addBox(hit)}
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
          {boxSearchError ? (
            <p className="sell-flow-partner-cert-error" role="alert">
              {boxSearchError}
            </p>
          ) : null}
        </div>
      </div>

      {boxes.length > 0 ? (
        <div className="sell-flow-glass sell-flow-glass--partner-cards sell-flow-glass--partner-boxes">
          <div className="sell-flow-cards-section">
            <div className="sell-flow-cards-header">
              <div className="sell-flow-cards-title">
                Your boxes <span className="sell-flow-cards-count">({boxes.length})</span>
              </div>
            </div>
            <input
              ref={boxPhotoInputRef}
              type="file"
              accept={SLAB_UPLOAD_ACCEPT}
              className="sr-only"
              disabled={boxMintBusy}
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                const localId = boxPhotoTargetRef.current;
                e.target.value = "";
                boxPhotoTargetRef.current = null;
                if (!next || !localId) return;
                attachBoxPhoto(localId, next);
              }}
            />
            <div className="sell-flow-cards-box">
              <ul className="sell-flow-cards-list">
                {boxes.map((box) => {
                  const previewUrl =
                    box.photoUrl ??
                    (box.coverDismissed ? null : box.product.coverImageUrl) ??
                    null;
                  const usingCover = !box.photo && !box.coverDismissed && Boolean(box.product.coverImageUrl);
                  return (
                  <li key={box.localId} className="sell-flow-cardrow sell-flow-boxrow">
                    <div className="sell-flow-boxrow__media">
                    {previewUrl ? (
                      <>
                        <button
                          type="button"
                          className="sell-flow-boxrow__shot"
                          disabled={boxMintBusy}
                          aria-label={
                            usingCover
                              ? `Representative image for ${box.product.productName}. Upload your own to replace it.`
                              : `Replace photo for ${box.product.productName}`
                          }
                          onClick={() => {
                            boxPhotoTargetRef.current = box.localId;
                            boxPhotoInputRef.current?.click();
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={previewUrl} alt="" className="sell-flow-boxrow__thumb" />
                        </button>
                        <button
                          type="button"
                          className="sell-flow-boxrow__clear"
                          disabled={boxMintBusy}
                          aria-label={
                            usingCover
                              ? `Remove representative image for ${box.product.productName}`
                              : `Remove photo for ${box.product.productName}`
                          }
                          onClick={() => clearBoxImage(box.localId)}
                        >
                          <svg width="7" height="7" viewBox="0 0 7 7" fill="none" aria-hidden>
                            <path d="M0.6875 0.6875L6.1875 6.1875" stroke="white" strokeWidth="1.375" strokeLinecap="round" />
                            <path d="M6.1875 0.6875L0.6875 6.1875" stroke="white" strokeWidth="1.375" strokeLinecap="round" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="sell-flow-boxrow__upload"
                        disabled={boxMintBusy}
                        onClick={() => {
                          boxPhotoTargetRef.current = box.localId;
                          boxPhotoInputRef.current?.click();
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M12 16V6" />
                          <path d="M8 9l4-4 4 4" />
                          <path d="M6 18h12" />
                        </svg>
                        Upload image
                      </button>
                    )}
                    </div>
                    <div className="sell-flow-cardrow__body">
                      <div className="sell-flow-cardrow__name">{box.product.productName}</div>
                      <div className="sell-flow-cardrow__sub">{boxHitSubtitle(box.product)}</div>
                    </div>
                    <button
                      type="button"
                      className="sell-flow-cardrow__del"
                      aria-label={`Remove ${box.product.productName}`}
                      title="Remove box"
                      disabled={boxMintBusy}
                      onClick={() => removeBox(box.localId)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </li>
                  );
                })}
              </ul>
            </div>
          </div>
          {boxesMissingPhoto > 0 ? (
            <p className="sell-flow-box-need-photo" role="status">
              {boxesMissingPhoto === 1
                ? "1 box needs your photo before it can be minted."
                : `${boxesMissingPhoto} boxes need your photo before they can be minted.`}
            </p>
          ) : null}
          <div className="sell-flow-cards-cta">
            <TkButton
              type="button"
              variant="primary"
              className="sell-flow-ship-btn"
              disabled={boxMintBusy || boxesReady.length === 0}
              onClick={() => void mintBoxes()}
            >
              {boxMintBusy ? (
                <>
                  <span className="sell-flow-spinner" aria-hidden /> Minting…
                </>
              ) : (
                <>
                  Mint {boxesReady.length} {boxesReady.length === 1 ? "box" : "boxes"} to
                  collection
                </>
              )}
            </TkButton>
          </div>
          {boxMintError ? (
            <p className="sell-flow-mint-error" role="alert">
              {boxMintError}
            </p>
          ) : null}
        </div>
      ) : null}

      <SellFlowPartnerMintBackground
        itemKind="box"
        visible={boxMintBusy && mintProgressHidden}
        done={mintDone}
        total={mintTotal}
        onShow={() => setMintProgressHidden(false)}
      />
      <SellFlowPartnerMintModal
        itemKind="box"
        mintBusy={boxMintBusy}
        done={mintDone}
        total={mintTotal}
        progressHidden={mintProgressHidden}
        onProgressHiddenChange={setMintProgressHidden}
        result={mintResult}
        onDismissResult={() => setMintResult(null)}
        onRetryFailed={() => void mintBoxes()}
      />
    </>
  );
}
