"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PortfolioCertificateModel } from "@/hooks/portfolio/usePortfolioCertificate";
import { formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";
import { joinCardDisplaySegments } from "@/lib/marketplace/cardDisplayName";
import {
  formatCertDate,
  formatMarketChangePct,
  formatWalletShort,
} from "@/lib/portfolio/portfolioCertificateFormat";

type CertData = PortfolioCertificateModel;

export function PortfolioCertificateView({
  tokenId,
  tokenIdOk,
  data: d,
  backHref,
  onRedeem,
  onSellList,
}: {
  tokenId: number;
  tokenIdOk: boolean;
  data: CertData;
  backHref: string;
  onRedeem: () => void;
  onSellList: () => void;
}) {
  const [tab, setTab] = useState<"proof" | "history">("proof");
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomFace, setZoomFace] = useState<"front" | "back">("front");
  const [zoomed, setZoomed] = useState(false);

  const front = d.imageUrl;
  const back = d.backUrl;
  const zoomSrc = zoomFace === "back" && back ? back : front;
  const chg = formatMarketChangePct(d.marketChangePct);
  const paid = d.holding?.costBasisUsd;
  const ownerLabel = d.isOwner
    ? `You · ${formatWalletShort(d.walletAddress)}`
    : d.walletAddress
      ? formatWalletShort(d.walletAddress)
      : "—";

  const openZoom = useCallback((face: "front" | "back") => {
    setZoomFace(face);
    setZoomed(false);
    setZoomOpen(true);
  }, []);

  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoomOpen]);

  if (!tokenIdOk) {
    return (
      <div className="pa-page">
        <p className="pa-status">Invalid asset.</p>
      </div>
    );
  }

  if (d.metaLoading && !d.imageUrl && !d.metadata) {
    return (
      <div className="pa-page">
        <p className="pa-status">Loading certificate…</p>
      </div>
    );
  }

  const redeemNote = d.redeemBadge
    ? d.redeemBadge.label
    : "Redeem the physical card from the vault anytime.";

  return (
    <div className="pa-page">
      <div className="cert-wrap">
        <Link className="backlink" href={backHref}>
          ‹ Portfolio
        </Link>

        <div className="cert">
          <span className="cbrk tl" aria-hidden />
          <span className="cbrk tr" aria-hidden />
          <span className="cbrk bl" aria-hidden />
          <span className="cbrk br" aria-hidden />
          <div className="cert-head">
            <span className="cert-title">◆ Certificate of Ownership</span>
            {d.explorerUrl ? (
              <a
                className="cert-id"
                href={d.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {d.headerTokenLabel} ↗
              </a>
            ) : (
              <span className="cert-id">{d.headerTokenLabel}</span>
            )}
          </div>

          <div className="hair" />

          <div className="subject">
            <div className="showcase">
              <div className="slab-tilt">
                <div
                  className="slab3d"
                  role="button"
                  tabIndex={0}
                  onClick={() => openZoom("front")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openZoom("front");
                  }}
                >
                  <div className="sface sfront">
                    {front ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={front} alt="Graded slab — front" />
                    ) : null}
                    <span className="sheen" />
                  </div>
                  {back ? (
                    <div className="sface sback">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={back} alt="Graded slab — back" />
                      <span className="sheen" />
                    </div>
                  ) : (
                    <div className="sface sback sback--empty">
                      <span>No intake back photo</span>
                    </div>
                  )}
                  <div className="sedge sedge-l" />
                  <div className="sedge sedge-r" />
                  <div className="sedge sedge-t" />
                  <div className="sedge sedge-b" />
                </div>
              </div>
              <span
                className="slab-cap"
                role="button"
                tabIndex={0}
                onClick={() => openZoom("front")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openZoom("front");
                  }
                }}
              >
                🔍 Inspect condition
              </span>
            </div>
            <div className="subj-info">
              <div className="subj-name">
                {joinCardDisplaySegments([d.titleName, d.titleNumber])}
              </div>
              <div className="subj-meta">
                {d.setLine ? <div>{d.setLine}</div> : null}
                {d.idLine ? <div>{d.idLine}</div> : null}
              </div>
              <div className="subj-grade">
                {d.gradeChip ? <span className="g">{d.gradeChip}</span> : null}
                {d.certNumber ? <span className="c">Cert #{d.certNumber}</span> : null}
              </div>
              <div className="stub">
                <div className="stub-row">
                  <span className="stub-k">Owner</span>
                  <span className="stub-v">{ownerLabel}</span>
                </div>
                <div className="stub-row">
                  <span className="stub-k">Status</span>
                  <span className={`stub-v${d.isOwner ? " pos" : ""}`}>{d.statusLine}</span>
                </div>
                <div className="stub-row">
                  <span className="stub-k">Acquired</span>
                  <span className="stub-v">{formatCertDate(d.holding?.acquiredAt)}</span>
                </div>
                <div className="stub-row">
                  <span className="stub-k">You paid</span>
                  <span className="stub-v">
                    {paid != null ? formatPortfolioUsd(paid) : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="redeem-note">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand-400)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <span>{redeemNote}</span>
          </div>

          <div className="perf" />

          <div className="tabs">
            <button
              type="button"
              className={`tab${tab === "proof" ? " on" : ""}`}
              onClick={() => setTab("proof")}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  setTab("history");
                }
              }}
            >
              Custody & proof
            </button>
            <button
              type="button"
              className={`tab${tab === "history" ? " on" : ""}`}
              onClick={() => setTab("history")}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  setTab("proof");
                }
              }}
            >
              History
            </button>
          </div>

          {tab === "proof" ? (
            <div>
              <div className="proof-h">Verify it yourself</div>
              {d.certNumber ? (
                <div className="prow">
                  <span className="prow-ic">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  </span>
                  <span>
                    <span className="prow-k">PSA grading certificate</span>
                    <span className="prow-s">
                      Cert #{d.certNumber}
                      {d.gradeSub ? ` · ${d.gradeSub}` : d.gradeChip ? ` · ${d.gradeChip}` : ""}
                    </span>
                  </span>
                  {d.psaVerifyUrl ? (
                    <a className="prow-a" href={d.psaVerifyUrl} target="_blank" rel="noopener noreferrer">
                      Verify on PSA ↗<span className="prow-ext">opens PSA</span>
                    </a>
                  ) : (
                    <span className="prow-chk">On file</span>
                  )}
                </div>
              ) : null}
              <div className="prow">
                <span className="prow-ic">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2 3 7v10l9 5 9-5V7z" />
                    <path d="M12 22V12" />
                    <path d="m3 7 9 5 9-5" />
                  </svg>
                </span>
                <span>
                  <span className="prow-k">On-chain ownership token</span>
                  <span className="prow-s">{d.chainLine}</span>
                </span>
                {d.explorerUrl ? (
                  <a className="prow-a" href={d.explorerUrl} target="_blank" rel="noopener noreferrer">
                    View on-chain ↗<span className="prow-ext">opens explorer</span>
                  </a>
                ) : (
                  <span className="prow-chk">Token #{tokenId}</span>
                )}
              </div>
            </div>
          ) : (
            <div>
              {d.history.length === 0 && !d.tradesLoading ? (
                <p className="note">No Tokenable trades recorded for this token yet.</p>
              ) : null}
              {d.history.map((n) => (
                <div key={n.id} className={`hist-node${n.highlight ? " hl" : ""}`}>
                  <span className="hist-line" />
                  <span className={`hist-dot${n.you ? " you" : ""}`}>
                    <i />
                  </span>
                  <div className="hist-top">
                    <span className="hist-l">
                      {n.label}
                      {n.you ? <span className="you-chip">OWNERSHIP TRANSFERRED</span> : null}
                    </span>
                    {n.amount ? <span className="hist-amt">{n.amount}</span> : null}
                  </div>
                  <div className="hist-d">{n.detail}</div>
                </div>
              ))}
              <p className="note">
                Only verified Tokenable transactions enter this history; unverified
                external or private sales stay as market comps.
              </p>
            </div>
          )}

          <div className="hair" />

          <div className="cert-foot">
            <div className="mval">
              <span className="mval-k">Market value</span>
              <span className="mval-v">{formatPortfolioUsd(d.marketUsd)}</span>
              {chg ? (
                <span className={`mval-chg${chg.positive ? "" : " neg"}`}>{chg.text}</span>
              ) : null}
            </div>
            {d.listed && d.listing?.priceUsd != null ? (
              <div className="mval">
                <span className="mval-k">Listed</span>
                <span className="mval-v mval-v--listed">
                  {formatPortfolioUsd(d.listing.priceUsd)}
                </span>
              </div>
            ) : null}
            <div className="foot-actions">
              <button
                type="button"
                className="btn btn--subtle"
                disabled={
                  d.redeemBadge
                    ? false
                    : !d.isOwner || !d.canSign || d.listed
                }
                title={
                  d.redeemBadge
                    ? d.redeemBadge.label
                    : d.listed
                      ? "Cancel the listing before redeeming"
                      : !d.isOwner
                        ? "Only the owner can redeem"
                        : undefined
                }
                onClick={onRedeem}
              >
                {d.redeemBadge ? "Redemption status" : "Redeem"}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!d.isOwner || !d.canSign || d.redeemInFlight}
                title={
                  d.redeemInFlight
                    ? "Redemption in progress — listing unavailable"
                    : undefined
                }
                onClick={onSellList}
              >
                {d.listed ? "Edit price" : "Sell / List"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        id="pa-zoom"
        className={zoomOpen ? "open" : undefined}
        aria-hidden={!zoomOpen}
        onClick={(e) => {
          if (e.target === e.currentTarget) setZoomOpen(false);
        }}
      >
        <div className="paz-stage">
          <span className="paz-hint">Scroll / tap image to zoom</span>
          {zoomSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={`paz-img${zoomed ? " zoomed" : ""}`}
              src={zoomSrc}
              alt="Slab condition"
              style={zoomed ? { transform: "scale(2.1)" } : undefined}
              onMouseMove={(e) => {
                if (!zoomed) return;
                const r = e.currentTarget.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width;
                const py = (e.clientY - r.top) / r.height;
                e.currentTarget.style.transformOrigin = `${px * 100}% ${py * 100}%`;
              }}
              onClick={(e) => {
                e.stopPropagation();
                setZoomed((z) => {
                  if (z) e.currentTarget.style.transformOrigin = "center";
                  return !z;
                });
              }}
            />
          ) : null}
          <button
            type="button"
            className="paz-close"
            aria-label="Close"
            onClick={() => setZoomOpen(false)}
          >
            ✕
          </button>
          {back ? (
            <div className="paz-toggle">
              <button
                type="button"
                className={`paz-tb${zoomFace === "front" ? " on" : ""}`}
                onClick={() => {
                  setZoomFace("front");
                  setZoomed(false);
                }}
              >
                Front
              </button>
              <button
                type="button"
                className={`paz-tb${zoomFace === "back" ? " on" : ""}`}
                onClick={() => {
                  setZoomFace("back");
                  setZoomed(false);
                }}
              >
                Back
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
