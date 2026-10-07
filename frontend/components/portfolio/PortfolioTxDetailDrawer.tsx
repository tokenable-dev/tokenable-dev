"use client";

import { useEffect, useState } from "react";
import type { TxRow } from "@/lib/portfolio/portfolioTypes";
import { formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";
import { txAmountIsNonTrade, txKindClass, txKindLabel } from "@/lib/portfolio/buildPortfolioTxRows";
import { getChainContracts } from "@/lib/chains";
import { useAppChain } from "@/providers/AppChainProvider";
import { PortfolioHistoryStatusBadge } from "./PortfolioHistoryStatusBadge";

const FEE_PCT = 5;
const CLOSE_MS = 280;
const ETH_ADDR = /^0x[a-fA-F0-9]{40}$/;
const ETH_TX = /^0x[a-fA-F0-9]{64}$/;

function isAddress(value: string | null | undefined): value is string {
  if (!value || !ETH_ADDR.test(value)) return false;
  return !/^0+$/i.test(value.slice(2));
}

function shortHex(value: string): string {
  const s = value.trim();
  if (s.length < 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function explorerBase(url: string): string {
  return url.replace(/\/$/, "");
}

function OnchainValue({
  label,
  value,
  href,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  href?: string | null;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="pf-tx-drawer__row">
      <span className="pf-tx-drawer__k">{label}</span>
      <span className="pf-tx-drawer__hash-wrap">
        {href ? (
          <a
            className="tkl-mono pf-tx-drawer__hash pf-tx-drawer__hash-link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={value}
          >
            {shortHex(value)}
          </a>
        ) : (
          <span className="tkl-mono pf-tx-drawer__hash" title={value}>
            {shortHex(value)}
          </span>
        )}
        <button
          type="button"
          className="pf-tx-drawer__copy"
          title={copied ? "Copied" : "Copy"}
          aria-label={`Copy ${label}`}
          onClick={onCopy}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M4 2h7v2H6v9H4V2zm3 3h7v9H7V5z" />
          </svg>
        </button>
      </span>
    </div>
  );
}

function cardSubline(tx: TxRow): string {
  const grade = tx.gradeLabel?.trim();
  const cert = tx.certNumber?.trim();
  if (grade && cert) return `${grade} · Cert #${cert}`;
  if (grade) return grade;
  if (cert) return `Cert #${cert}`;
  return tx.category?.trim() || "—";
}

/** Portfolio.html `#hx-drawer` — transaction detail side panel. */
export function PortfolioTxDetailDrawer({
  tx,
  onClose,
}: {
  tx: TxRow | null;
  onClose: () => void;
}) {
  const { chain } = useAppChain();
  const [displayTx, setDisplayTx] = useState<TxRow | null>(tx);
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (tx) {
      setDisplayTx(tx);
      const id = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(id);
    }
    setOpen(false);
    const t = window.setTimeout(() => setDisplayTx(null), CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [tx]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    setCopiedKey(null);
  }, [displayTx?.orderHash]);

  if (!displayTx) return null;

  const status = displayTx.status;
  const fee = Math.round(displayTx.price * (FEE_PCT / 100));
  const isSell = displayTx.type === "SELL";
  const isMint = displayTx.type === "MINT";
  const isPending = status === "in_progress";
  const isFailed = status === "failed";
  const showMoney = !txAmountIsNonTrade(displayTx);
  const contracts = getChainContracts(chain.id);
  const scan = explorerBase(chain.explorerBaseUrl);
  const tokenContract =
    displayTx.tokenContract?.trim() || contracts.rwaAddress;
  const tokenId = displayTx.tokenId;
  const tokenHref =
    tokenId != null && isAddress(tokenContract)
      ? `${scan}/token/${tokenContract}?a=${tokenId}`
      : isAddress(tokenContract)
        ? `${scan}/token/${tokenContract}`
        : null;
  const seaportOrder =
    displayTx.type === "BUY" || displayTx.type === "SELL"
      ? displayTx.orderHash
      : null;
  const chainTxs = displayTx.chainTxs ?? [];

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <button
        type="button"
        className={`pf-tx-drawer-overlay${open ? " pf-tx-drawer-overlay--open" : ""}`}
        aria-label="Close transaction detail"
        onClick={onClose}
      />
      <aside
        className={`pf-tx-drawer${open ? " pf-tx-drawer--open" : ""}`}
        aria-label="Transaction detail"
      >
        <div className="pf-tx-drawer__head">
          <span className="pf-tx-drawer__title">Transaction Detail</span>
          <button
            type="button"
            className="pf-tx-drawer__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="pf-tx-drawer__body">
          <div className="pf-tx-drawer__card pf-tx-drawer__card--with-img">
            <div className="pf-tx-drawer__thumb">
              {displayTx.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayTx.imageUrl} alt="" />
              ) : null}
            </div>
            <div className="pf-tx-drawer__card-copy">
              <div className="pf-tx-drawer__card-name" title={displayTx.assetHover || displayTx.asset}>
                {displayTx.asset}
              </div>
              <div className="pf-tx-drawer__card-sub tkl-mono">{cardSubline(displayTx)}</div>
            </div>
          </div>

          <div className="pf-tx-drawer__meta">
            <div className="pf-tx-drawer__row">
              <span className="pf-tx-drawer__k">Type</span>
              <span className={`pf-tx-drawer__v pf-table-type ${txKindClass(displayTx)}`}>
                {txKindLabel(displayTx)}
              </span>
            </div>
            <div className="pf-tx-drawer__row">
              <span className="pf-tx-drawer__k">Date</span>
              <span className="pf-tx-drawer__v tkl-mono pf-table-muted">
                {displayTx.dateTimeLabel ?? displayTx.date}
              </span>
            </div>
            <div className="pf-tx-drawer__row">
              <span className="pf-tx-drawer__k">Status</span>
              <PortfolioHistoryStatusBadge status={status} />
            </div>
          </div>

          {showMoney ? (
            <>
              <div className="pf-tx-drawer__divider" />
              <div className="pf-tx-drawer__money">
                {isFailed ? (
                  <>
                    <div className="pf-tx-drawer__row">
                      <span className="pf-tx-drawer__k">
                        {isSell ? "Asking Price" : "Purchase Price"}
                      </span>
                      <span className="pf-tx-drawer__v tkl-mono">
                        {formatPortfolioUsd(displayTx.price)}
                      </span>
                    </div>
                    <p className="pf-tx-drawer__note pf-tx-drawer__note--danger tkl-mono">
                      Failed. No funds moved. Retry from the listing.
                    </p>
                  </>
                ) : isPending ? (
                  <>
                    <div className="pf-tx-drawer__row">
                      <span className="pf-tx-drawer__k">Listed Price</span>
                      <span className="pf-tx-drawer__v tkl-mono">
                        {formatPortfolioUsd(displayTx.price)}
                      </span>
                    </div>
                    <div className="pf-tx-drawer__row">
                      <span className="pf-tx-drawer__k">
                        Platform Fee ({FEE_PCT}%)
                      </span>
                      <span className="pf-tx-drawer__v tkl-mono pf-tx-drawer__fee">
                        -{formatPortfolioUsd(fee)}
                      </span>
                    </div>
                    <div className="pf-tx-drawer__divider pf-tx-drawer__divider--tight" />
                    <div className="pf-tx-drawer__row pf-tx-drawer__row--total">
                      <span className="pf-tx-drawer__k">Estimated Net</span>
                      <span className="pf-tx-drawer__v tkl-mono pf-tx-drawer__total pf-tx-drawer__total--pending">
                        {formatPortfolioUsd(displayTx.price - fee)}
                      </span>
                    </div>
                    <p className="pf-tx-drawer__note tkl-mono">
                      Settlement usually completes within a few minutes.
                    </p>
                  </>
                ) : isSell ? (
                  <>
                    <div className="pf-tx-drawer__row">
                      <span className="pf-tx-drawer__k">Settled Price</span>
                      <span className="pf-tx-drawer__v tkl-mono">
                        {formatPortfolioUsd(displayTx.price)}
                      </span>
                    </div>
                    <div className="pf-tx-drawer__row">
                      <span className="pf-tx-drawer__k">
                        Platform Fee ({FEE_PCT}%)
                      </span>
                      <span className="pf-tx-drawer__v tkl-mono pf-tx-drawer__fee">
                        -{formatPortfolioUsd(fee)}
                      </span>
                    </div>
                    <div className="pf-tx-drawer__divider pf-tx-drawer__divider--tight" />
                    <div className="pf-tx-drawer__row pf-tx-drawer__row--total">
                      <span className="pf-tx-drawer__k">Net Received</span>
                      <span className="pf-tx-drawer__v tkl-mono pf-tx-drawer__total pf-tx-drawer__total--pos">
                        {formatPortfolioUsd(displayTx.price - fee)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="pf-tx-drawer__row">
                      <span className="pf-tx-drawer__k">Purchase Price</span>
                      <span className="pf-tx-drawer__v tkl-mono">
                        {formatPortfolioUsd(displayTx.price)}
                      </span>
                    </div>
                    <div className="pf-tx-drawer__row">
                      <span className="pf-tx-drawer__k">
                        Platform Fee ({FEE_PCT}%)
                      </span>
                      <span className="pf-tx-drawer__v tkl-mono pf-tx-drawer__fee">
                        -{formatPortfolioUsd(fee)}
                      </span>
                    </div>
                    <div className="pf-tx-drawer__divider pf-tx-drawer__divider--tight" />
                    <div className="pf-tx-drawer__row pf-tx-drawer__row--total">
                      <span className="pf-tx-drawer__k">Total Paid</span>
                      <span className="pf-tx-drawer__v tkl-mono pf-tx-drawer__total">
                        {formatPortfolioUsd(displayTx.price + fee)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}

          {isMint ? (
            <>
              <div className="pf-tx-drawer__divider" />
              <div className="pf-tx-drawer__money">
                <div className="pf-tx-drawer__row">
                  <span className="pf-tx-drawer__k">Minted</span>
                  <span className="pf-tx-drawer__v tkl-mono">
                    {displayTx.dateTimeLabel ?? displayTx.date}
                  </span>
                </div>
              </div>
            </>
          ) : null}

          <div className="pf-tx-drawer__divider" />
          <div className="pf-tx-drawer__tx">
            <div className="pf-tx-drawer__row">
              <span className="pf-tx-drawer__k">Chain</span>
              <span className="pf-tx-drawer__v tkl-mono">{chain.shortLabel}</span>
            </div>
            {tokenId != null ? (
              <OnchainValue
                label="Token"
                value={`#${tokenId}`}
                href={tokenHref}
                copied={copiedKey === "token"}
                onCopy={() => void copyText("token", String(tokenId))}
              />
            ) : null}
            {isAddress(tokenContract) ? (
              <OnchainValue
                label="Contract"
                value={tokenContract}
                href={`${scan}/address/${tokenContract}`}
                copied={copiedKey === "contract"}
                onCopy={() => void copyText("contract", tokenContract)}
              />
            ) : null}
            {isAddress(displayTx.considerationToken) ? (
              <OnchainValue
                label="USDC"
                value={displayTx.considerationToken}
                href={`${scan}/token/${displayTx.considerationToken}`}
                copied={copiedKey === "usdc"}
                onCopy={() => void copyText("usdc", displayTx.considerationToken!)}
              />
            ) : null}
            {isAddress(displayTx.sellerWallet) ? (
              <OnchainValue
                label="Seller"
                value={displayTx.sellerWallet}
                href={`${scan}/address/${displayTx.sellerWallet}`}
                copied={copiedKey === "seller"}
                onCopy={() => void copyText("seller", displayTx.sellerWallet!)}
              />
            ) : null}
            {isAddress(displayTx.buyerWallet) ? (
              <OnchainValue
                label="Buyer"
                value={displayTx.buyerWallet}
                href={`${scan}/address/${displayTx.buyerWallet}`}
                copied={copiedKey === "buyer"}
                onCopy={() => void copyText("buyer", displayTx.buyerWallet!)}
              />
            ) : null}
            {chainTxs.map((tx) => {
              const hash = tx.hash.trim();
              const href = ETH_TX.test(hash) ? `${scan}/tx/${hash}` : null;
              return (
                <OnchainValue
                  key={`${tx.label}:${hash}`}
                  label={tx.label}
                  value={hash}
                  href={href}
                  copied={copiedKey === hash}
                  onCopy={() => void copyText(hash, hash)}
                />
              );
            })}
            {seaportOrder ? (
              <OnchainValue
                label="Seaport order"
                value={seaportOrder}
                copied={copiedKey === "seaport"}
                onCopy={() => void copyText("seaport", seaportOrder)}
              />
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
