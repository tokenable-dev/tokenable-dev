"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PortfolioCertificateModel } from "@/hooks/portfolio/usePortfolioCertificate";
import { formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";
import {
  formatCertDate,
  formatCertDateShort,
  formatMarketChangePct,
  formatPortfolioPassportId,
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
  const [custodyOpen, setCustodyOpen] = useState(false);
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

  const photoDate = formatCertDateShort(d.holding?.acquiredAt);

  return (
    <div className="pa-page">
      <div className="cert-wrap">
        <Link className="backlink" href={backHref}>
          ‹ Portfolio
        </Link>

        <div className="cert">
          <span className="cbrk tl" />
          <span className="cbrk tr" />
          <span className="cbrk bl" />
          <span className="cbrk br" />

          <div className="cert-head">
            <span className="cert-title">◆ Certificate of Ownership</span>
            <span className="cert-id">{formatPortfolioPassportId(tokenId)}</span>
          </div>

          <div className="hair" />

          {d.isOwner ? (
            <div className="own-banner">
              <span className="pulse" />
              <span>
                <b>You own this card</b>
                <span className="sub"> · {formatWalletShort(d.walletAddress)}</span>
              </span>
            </div>
          ) : null}

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
              <button type="button" className="slab-cap" onClick={() => openZoom("front")}>
                🔍 Inspect condition
              </button>
            </div>
            <div className="subj-info">
              <div className="subj-name">{d.nameLine}</div>
              <div className="subj-meta">
                {[d.setLine, d.idLine].filter(Boolean).join(" · ")}
              </div>
              <div className="subj-grade">
                {d.gradeChip ? <span className="g">{d.gradeChip}</span> : null}
                {d.certNumber ? <span className="c">Cert #{d.certNumber}</span> : null}
              </div>
            </div>
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

          <div className="redeem">
            <div className="redeem-ic">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--brand-400)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              </svg>
            </div>
            <div className="redeem-txt">
              <div className="redeem-h">Redeem anytime</div>
              <div className="redeem-p">
                The strongest proof it&rsquo;s really yours — take the physical card
                out of the vault whenever you want.
              </div>
            </div>
          </div>

          <div className="perf" />

          <div className="tabs">
            <button
              type="button"
              className={`tab${tab === "proof" ? " on" : ""}`}
              onClick={() => setTab("proof")}
            >
              Custody &amp; proof
            </button>
            <button
              type="button"
              className={`tab${tab === "history" ? " on" : ""}`}
              onClick={() => setTab("history")}
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

              {front ? (
                <div className="vphotos">
                  <div className="vphotos-h">Vault photos · captured on intake</div>
                  <div className={`vph-grid${back ? "" : " vph-grid--single"}`}>
                    <button type="button" className="vph" onClick={() => openZoom("front")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={front} alt="Vault photo front" />
                      <span className="vph-tag">Front</span>
                      {photoDate ? <span className="vph-date">{photoDate}</span> : null}
                    </button>
                    {back ? (
                      <button
                        type="button"
                        className="vph vph--back"
                        onClick={() => openZoom("back")}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={back} alt="Vault photo back" />
                        <span className="vph-tag">Back / slab</span>
                        {photoDate ? <span className="vph-date">{photoDate}</span> : null}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                className="proof-disc"
                aria-expanded={custodyOpen}
                onClick={() => setCustodyOpen((v) => !v)}
              >
                <span>View full custody record</span>
                <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {custodyOpen ? (
                <div className="proof-baseline">
                  <div className="prow">
                    <span className="prow-ic">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </span>
                    <span>
                      <span className="prow-k">Custody — {d.vaultLabel}</span>
                      <span className="prow-s">Secured vault custody</span>
                    </span>
                    <span className="prow-chk">✓ In vault</span>
                  </div>
                  <p className="note" style={{ marginTop: 8 }}>
                    Insurance policy numbers and dated physical audits are shown when
                    the vault publishes them. They are omitted here until that data
                    is available.
                  </p>
                </div>
              ) : null}
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
                Sell / List
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
              onClick={(e) => {
                e.stopPropagation();
                setZoomed((z) => !z);
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
