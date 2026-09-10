"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "wagmi";
import { TkButton } from "@/components/ds";
import { CARD_DISPLAY_LINE1_CLAMP_CLASS } from "@/components/marketplace/marketplace-shared";
import { ListRwaModalSuccessView } from "@/components/marketplace/list-rwa/ListRwaModalSuccessView";
import { useListRwaModal } from "@/hooks/list-rwa";
import { useAppChain } from "@/providers/AppChainProvider";
import { formatAssetDetailLine1 } from "@/lib/marketplace/assetDetailHeadline";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import { feePercent } from "@/lib/seaport/orders/platformFee";
import { shortenWalletAddress } from "@/lib/wallet/walletMenuDisplay";
import type { Order } from "@/lib/core";

function money(n: number): string {
  if (!(n > 0) || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/**
 * Card.html `#tk-bidconf` — List for sale confirm (after trade-panel Sell).
 */
export function CollectionListConfirmModal({
  open,
  tokenId,
  priceUsd,
  imageUrl,
  assetTitle,
  headlineParts,
  headlineGrade,
  headlineMeta,
  certLabel,
  vaultLabel,
  collectionKey,
  collectionBids,
  onClose,
  onListed,
  onMatchedSale,
}: {
  open: boolean;
  tokenId: number;
  priceUsd: number;
  imageUrl?: string | null;
  assetTitle?: string | null;
  headlineParts?: AssetDetailHeadlineParts | null;
  headlineGrade?: string | null;
  headlineMeta?: string | null;
  certLabel: string;
  vaultLabel: string;
  collectionKey: string;
  collectionBids?: Order[];
  onClose: () => void;
  onListed?: () => void;
  onMatchedSale?: () => void;
}) {
  const { address } = useAccount();
  const { chain } = useAppChain();
  const [mounted, setMounted] = useState(false);

  const initialPrice = useMemo(
    () => (priceUsd > 0 ? String(Math.round(priceUsd)) : undefined),
    [priceUsd],
  );

  const modal = useListRwaModal({
    tokenId,
    collectionKey,
    collectionBids,
    initialPriceUsdc: initialPrice,
    onClose,
    onListed: onListed ? () => onListed() : undefined,
    onMatchedSale,
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || modal.step === "success") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, modal.step]);

  // Keep price locked to trade-panel value.
  useEffect(() => {
    if (!open || !initialPrice) return;
    if (modal.price !== initialPrice) modal.setPrice(initialPrice);
  }, [open, initialPrice, modal.price, modal.setPrice]);

  if (!open || !mounted || typeof document === "undefined") return null;

  if (modal.step === "success") {
    return (
      <ListRwaModalSuccessView
        tokenId={tokenId}
        price={modal.price}
        isReplaceListing={modal.isReplaceListing}
        successMeta={modal.successMeta}
        settlementPolicy={modal.settlementPolicy}
        onClose={onClose}
      />
    );
  }

  const title =
    (headlineParts
      ? formatAssetDetailLine1(headlineParts, { grade: headlineGrade })
      : null) ||
    assetTitle?.trim() ||
    `Token #${tokenId}`;
  const meta = headlineMeta?.trim() || "";
  const cardLine = `${certLabel} · ${vaultLabel}`;
  const priceN = Math.round(priceUsd);
  const isSelfVault = modal.settlementPolicy === "self_vault_hold";
  const feePct = isSelfVault ? 5 : feePercent(modal.settlementPolicy ?? "standard");
  const feeN = priceN > 0 ? Math.round((priceN * feePct) / 100) : 0;
  const netN = priceN > 0 ? priceN - feeN : 0;
  const busy = modal.isProcessing;
  const ctaLabel = busy
    ? modal.step === "approving"
      ? "Approving…"
      : modal.step === "signing" || modal.step === "submitting"
        ? "Listing…"
        : modal.step === "matching"
          ? "Matching…"
          : "Processing…"
    : "Approve listing";

  return createPortal(
    <div
      className="cd-list-confirm"
      id="tk-bidconf"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bidconf-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="cd-list-confirm__sheet notch">
        <div className="cd-list-confirm__top">
          <button
            type="button"
            className="cd-list-confirm__close"
            id="bidconf-x"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            ✕
          </button>
          <h3 id="bidconf-title" className="cd-list-confirm__title">
            List for sale
          </h3>

          <div className="cd-list-confirm__item">
            <div className="cd-list-confirm__thumb">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" />
              ) : null}
            </div>
            <div className="cd-list-confirm__item-meta">
              <div
                className={`cd-list-confirm__item-title ${CARD_DISPLAY_LINE1_CLAMP_CLASS}`}
                title={title}
              >
                {title}
              </div>
              {meta ? (
                <div className="cd-list-confirm__item-sub tkl-mono">{meta}</div>
              ) : null}
            </div>
          </div>

          <div id="bidconf-rows" className="cd-list-confirm__rows">
            <div className="cd-list-confirm__card">
              <span className="cd-list-confirm__card-lbl">Your card</span>
              <span className="cd-list-confirm__card-val tkl-mono">{cardLine}</span>
            </div>
            <div className="cd-list-confirm__row">
              <span className="cd-list-confirm__row-lbl tkl-mono">Your price</span>
              <span className="cd-list-confirm__row-val tkl-mono">{money(priceN)}</span>
            </div>
            <div className="cd-list-confirm__row">
              <span className="cd-list-confirm__row-lbl tkl-mono">
                Platform fee ({feePct}%)
              </span>
              <span className="cd-list-confirm__row-val cd-list-confirm__row-val--warn tkl-mono">
                −{money(feeN)}
              </span>
            </div>
            <div className="cd-list-confirm__row">
              <span className="cd-list-confirm__row-lbl tkl-mono">You receive</span>
              <span className="cd-list-confirm__row-val cd-list-confirm__row-val--pos tkl-mono">
                {money(netN)}
              </span>
            </div>
          </div>

          {modal.step === "error" && modal.errorMsg ? (
            <p className="cd-list-confirm__error" role="alert">
              {modal.errorMsg}
            </p>
          ) : null}
        </div>

        <div className="cd-list-confirm__bottom">
          <div id="bidconf-privy" className="cd-list-confirm__privy">
            <div className="cd-list-confirm__row">
              <span className="cd-list-confirm__row-lbl tkl-mono">Token</span>
              <span className="cd-list-confirm__row-val tkl-mono">
                {address ? shortenWalletAddress(address) : "—"}
              </span>
            </div>
            <div className="cd-list-confirm__row">
              <span className="cd-list-confirm__row-lbl tkl-mono">Network</span>
              <span className="cd-list-confirm__row-val tkl-mono">
                {chain.label}
              </span>
            </div>
          </div>
          <TkButton
            type="button"
            variant="primary"
            className="cd-list-confirm__cta"
            id="bidconf-go"
            disabled={busy || !(priceN > 0)}
            onClick={() => void modal.handleList()}
          >
            {ctaLabel}
          </TkButton>
          <div className="cd-list-confirm__foot tkl-mono" data-bidconf-foot="">
            <span>
              Protected by <b>privy</b>
            </span>
            <span className="cd-list-confirm__foot-dot" aria-hidden>
              ·
            </span>
            <span>You receive USDC when it sells. No listing fee.</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
