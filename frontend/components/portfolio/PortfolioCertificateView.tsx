"use client";

import { useDisplayFx } from "@/components/i18n/DisplayPreferencesProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { PortfolioCertificateModel } from "@/hooks/portfolio/usePortfolioCertificate";
import type { PortfolioCostBasisSource } from "@/lib/core/api/portfolio";
import { formatPortfolioCostBasis } from "@/lib/portfolio/portfolioTableHelpers";
import { formatUsdCompact, formatUsdListing } from "@/lib/market/collectionMarketPricing";
import { joinCardDisplaySegments } from "@/lib/marketplace/cardDisplayName";
import {
  COLLECTION_TRADE_SELF_VAULT_LABEL,
  PSA_VAULT_LABEL,
} from "@/lib/marketplace/vaultCustodyLabel";
import {
  formatCertDate,
  formatCertValueChange,
  formatMarketChangePct,
  formatWalletShort,
} from "@/lib/portfolio/portfolioCertificateFormat";

type PortfolioCopy = ReturnType<typeof useTranslations<"Portfolio">>;

function dateLocale(locale: string): string {
  return locale === "en" ? "en-US" : locale;
}

function localizeVaultText(text: string, t: PortfolioCopy): string {
  return text
    .replaceAll(PSA_VAULT_LABEL, t("psaVault"))
    .replaceAll(COLLECTION_TRADE_SELF_VAULT_LABEL, t("toknVault"));
}

function historyLabel(label: string, t: PortfolioCopy): string {
  if (
    label === "vaultEntry" ||
    label === "youBought" ||
    label === "soldOn" ||
    label === "matchedOn"
  ) {
    return t(label);
  }
  return label;
}

function redeemCopy(label: string, t: PortfolioCopy): string {
  if (label === "In your possession") return t("inPossession");
  if (label === "Delivered — confirm receipt") return t("deliveredConfirm");
  if (label === "In transit") return t("inTransit");
  if (label === "Redeeming — preparing") return t("redeemPreparing");
  if (label === "Redeeming — finish transfer") return t("redeemFinish");
  return label;
}

type CertData = PortfolioCertificateModel;

function changeClass(change: ReturnType<typeof formatMarketChangePct>): string {
  if (!change || change.muted) return "";
  return change.positive ? "px-pos" : "px-neg";
}

function PricingPanel({
  data: d,
  paid,
  costSource,
}: {
  data: CertData;
  paid: number | null;
  costSource: PortfolioCostBasisSource | null;
}) {
  useDisplayFx(); // re-render on display currency / FX change
  const t = useTranslations("Portfolio");
  const locale = useLocale();
  const pricing = d.pricing;
  const top = formatMarketChangePct(pricing.change30Pct);
  const valueChange = formatCertValueChange(d.marketUsd, paid, costSource);
  const c30 = formatMarketChangePct(pricing.change30Pct);
  const c90 = formatMarketChangePct(pricing.change90Pct);
  const c1y = formatMarketChangePct(pricing.change365Pct);
  const changeCells = [
    pricing.lastSaleUsd != null
      ? { key: "lastSale" as const, value: formatUsdCompact(pricing.lastSaleUsd), tone: "" }
      : null,
    c30 ? { key: "day30" as const, value: c30.label, tone: changeClass(c30) } : null,
    c90 ? { key: "day90" as const, value: c90.label, tone: changeClass(c90) } : null,
    c1y ? { key: "year1" as const, value: c1y.label, tone: changeClass(c1y) } : null,
  ].filter((cell): cell is { key: "lastSale" | "day30" | "day90" | "year1"; value: string; tone: string } => cell != null);
  const range =
    pricing.rangeLowUsd != null && pricing.rangeHighUsd != null
      ? `${formatUsdCompact(pricing.rangeLowUsd)} – ${formatUsdCompact(pricing.rangeHighUsd)}`
      : null;

  return (
    <div>
      <div className="proof-h">{t("marketValue")}</div>
      <div className="px-top">
        <span className="v">{formatUsdCompact(d.marketUsd)}</span>
        {top && !top.muted ? (
          <span className={`c ${changeClass(top)}`}>
            {top.arrow} {top.label} · {t("change30d")}
          </span>
        ) : null}
      </div>
      {paid != null ? (
        <div className="px-sub">
          {t("youPaid")} <span className="m">{formatPortfolioCostBasis(paid, costSource)}</span>
          {valueChange ? (
            <>
              {" · "}
              <span className={valueChange.tone === "neg" ? "px-neg" : valueChange.tone === "pos" ? "px-pos" : ""}>
                {t("valueChangeInline")}{" "}
                <span className="m">
                  {valueChange.usdLabel} ({valueChange.pctLabel})
                </span>
              </span>
            </>
          ) : null}
        </div>
      ) : null}
      {changeCells.length > 0 ? (
        <>
          <div className="proof-h">{t("priceChange")}</div>
          <div className="px-grid">
            {changeCells.map((cell) => (
              <div key={cell.key} className="px-cell">
                <div className="k">{t(cell.key)}</div>
                <div className={`n ${cell.tone}`}>{cell.value}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {range || pricing.sales12mo != null ? (
        <div className="px-grid two">
          {range ? (
            <div className="px-cell">
              <div className="k">{t("range12")}</div>
              <div className="n">{range}</div>
            </div>
          ) : null}
          {pricing.sales12mo != null ? (
            <div className="px-cell">
              <div className="k">{t("sales12")}</div>
              <div className="n">{pricing.sales12mo}</div>
            </div>
          ) : null}
        </div>
      ) : null}
      {pricing.recentSales.length > 0 ? (
        <>
          <div className="proof-h">{t("recentSales")}</div>
          {pricing.recentSales.map((sale) => (
            <div key={sale.id} className="px-row">
              <span>
                <span className="d">
                  {formatCertDate(new Date(sale.atSec * 1000).toISOString(), dateLocale(locale))}
                </span>
                {d.gradeChip ? <span className="g">{d.gradeChip}</span> : null}
              </span>
              <span className="p">{formatUsdCompact(sale.priceUsd)}</span>
            </div>
          ))}
        </>
      ) : null}
      {d.marketUsd == null && changeCells.length === 0 && pricing.recentSales.length === 0 ? (
        <p className="note">{t("noPricing")}</p>
      ) : null}
    </div>
  );
}
type CertTab = "proof" | "history" | "pricing";
const CERT_TABS: CertTab[] = ["proof", "history", "pricing"];

function moveCertTab(current: CertTab, dir: 1 | -1): CertTab {
  const index = CERT_TABS.indexOf(current);
  return CERT_TABS[(index + dir + CERT_TABS.length) % CERT_TABS.length];
}

export function PortfolioCertificateView({
  tokenId,
  tokenIdOk,
  data: d,
  backHref,
  onRedeem,
  onSellList,
  onCancelListing,
  cancelListingPending = false,
  holdOnly = false,
}: {
  tokenId: number;
  tokenIdOk: boolean;
  data: CertData;
  backHref: string;
  onRedeem: () => void;
  onSellList: () => void;
  /** PortfolioAsset.html — Cancel listing sits on the Sale listing prow. */
  onCancelListing?: () => void;
  cancelListingPending?: boolean;
  /** Sealed box: show the holding, without card list or redeem. */
  holdOnly?: boolean;
}) {
  useDisplayFx(); // re-render on display currency / FX change
  const t = useTranslations("Portfolio");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const [tab, setTab] = useState<CertTab>("proof");
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomFace, setZoomFace] = useState<"front" | "back">("front");
  const [zoomed, setZoomed] = useState(false);
  const zoomImgRef = useRef<HTMLImageElement>(null);

  const front = d.imageUrl;
  const back = d.backUrl;
  const zoomSrc = zoomFace === "back" && back ? back : front;
  const chg = formatMarketChangePct(d.marketChangePct);
  const paid = d.holding?.costBasisUsd ?? null;
  const costSource = d.holding?.costBasisSource ?? null;
  const valueChange = formatCertValueChange(d.marketUsd, paid, costSource);
  const ownerLabel = d.isOwner
    ? t("youOwner", { wallet: formatWalletShort(d.walletAddress) })
    : d.walletAddress
      ? formatWalletShort(d.walletAddress)
      : "—";

  const openZoom = useCallback((face: "front" | "back") => {
    setZoomFace(face);
    setZoomed(false);
    setZoomOpen(true);
  }, []);

  useEffect(() => {
    if (!zoomOpen) {
      setZoomed(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const body = document.body;
    const prev = body?.style.overflow ?? "";
    if (body) body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      if (body) body.style.overflow = prev;
    };
  }, [zoomOpen]);

  useEffect(() => {
    if (zoomed) return;
    const img = zoomImgRef.current;
    if (img) img.style.transformOrigin = "center";
  }, [zoomed]);

  if (!tokenIdOk) {
    return (
      <div className="pa-page">
        <p className="pa-status">{t("invalidAsset")}</p>
      </div>
    );
  }

  if (d.metaLoading && !d.imageUrl && !d.metadata) {
    return (
      <div className="pa-page">
        <p className="pa-status">{t("loadingCert")}</p>
      </div>
    );
  }

  const dates = dateLocale(locale);
  const redeemNote = d.redeemBadge
    ? redeemCopy(d.redeemBadge.label, t)
    : t("redeemAnytime");
  const statusText = localizeVaultText(d.statusLine, t);
  const chainLine = d.chainLine.replace(
    `token #${tokenId}`,
    t("chainToken", { id: String(tokenId) }),
  );
  const headerToken = d.headerTokenLabel.startsWith("Token · ")
    ? `${t("tokenWord")} · ${d.headerTokenLabel.slice("Token · ".length)}`
    : d.headerTokenLabel;

  return (
    <div className="pa-page">
      <div className="cert-wrap">
        <Link className="backlink" href={backHref}>
          ‹ {tNav("collection")}
        </Link>

        <div className="cert">
          <div className="cert-head">
            <span className="cert-title">◈ {t("certTitle")}</span>
            {d.explorerUrl ? (
              <a
                className="cert-id"
                href={d.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {headerToken} ↗
              </a>
            ) : (
              <span className="cert-id">{headerToken}</span>
            )}
          </div>

          <div className="hair" />

          <div className="subject">
            <div className={`showcase${holdOnly ? " showcase--flat" : ""}`}>
              {holdOnly ? (
                <>
                  <button
                    type="button"
                    className="box-cover"
                    onClick={() => openZoom("front")}
                    aria-label={t("inspectBox")}
                  >
                    {front ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={front} alt={t("sealedBoxAlt")} />
                    ) : (
                      <span className="box-cover-empty">{t("noImage")}</span>
                    )}
                  </button>
                  {front ? (
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
                      {t("inspect")}
                    </span>
                  ) : null}
                </>
              ) : (
                <>
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
                          <img src={front} alt={t("slabFrontAlt")} />
                        ) : null}
                        <span className="sheen" />
                      </div>
                      {back ? (
                        <div className="sface sback">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={back} alt={t("slabBackAlt")} />
                          <span className="sheen" />
                        </div>
                      ) : (
                        <div className="sface sback sback--empty">
                          <span>{t("noBackPhoto")}</span>
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
                    {t("inspect")}
                  </span>
                </>
              )}
            </div>
            <div className="subj-info">
              <div className="subj-name">
                {joinCardDisplaySegments([d.titleName, d.titleNumber])}
              </div>
              <div className="subj-meta">
                {d.setLine && d.idLine && !d.setLine.endsWith(d.idLine)
                  ? `${d.setLine} · ${d.idLine}`
                  : d.setLine || d.idLine || null}
              </div>
              <div className="subj-grade">
                {d.gradeChip ? <span className="g">{d.gradeChip}</span> : null}
                {d.certNumber ? <span className="c">{t("certHash", { number: d.certNumber })}</span> : null}
              </div>
              <div className="stub">
                <div className="stub-row">
                  <span className="stub-k">{t("owner")}</span>
                  <span className="stub-v">{ownerLabel}</span>
                </div>
                <div className="stub-row">
                  <span className="stub-k">{t("status")}</span>
                  <span className={`stub-v${d.statusLine.startsWith("●") ? " pos" : ""}`}>
                    {statusText}
                  </span>
                </div>
                <div className="stub-row">
                  <span className="stub-k">{t("acquired")}</span>
                  <span className="stub-v">{formatCertDate(d.holding?.acquiredAt, dates)}</span>
                </div>
                <div className="stub-row">
                  <span className="stub-k">{t("youPaid")}</span>
                  <span className="stub-v">
                    {formatPortfolioCostBasis(paid, costSource)}
                  </span>
                </div>
                {valueChange ? (
                  <div className="stub-row">
                    <span className="stub-k">{t("valueChange")}</span>
                    <span className={`stub-v${valueChange.tone === "flat" ? "" : ` ${valueChange.tone}`}`}>
                      {valueChange.usdLabel} · {valueChange.pctLabel}
                    </span>
                  </div>
                ) : null}
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
            {(
              [
                ["proof", t("custodyProof")],
                ["history", t("history")],
                ["pricing", t("pricing")],
              ] as [CertTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`tab${tab === id ? " on" : ""}`}
                data-cert-tab={id}
                onClick={() => setTab(id)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                  e.preventDefault();
                  const next = moveCertTab(tab, e.key === "ArrowRight" ? 1 : -1);
                  setTab(next);
                  queueMicrotask(() => {
                    document
                      .querySelector<HTMLButtonElement>(`[data-cert-tab="${next}"]`)
                      ?.focus();
                  });
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "proof" ? (
            <div>
              <div className="proof-h">{t("verifyYourself")}</div>
              {d.certNumber ? (
                <div className="prow">
                  <span className="prow-ic">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  </span>
                  <span>
                    <span className="prow-k">{t("psaCert")}</span>
                    <span className="prow-s">
                      {t("certHash", { number: d.certNumber })}
                      {d.gradeSub ? ` · ${d.gradeSub}` : d.gradeChip ? ` · ${d.gradeChip}` : ""}
                    </span>
                  </span>
                  {d.psaVerifyUrl ? (
                    <a className="prow-a" href={d.psaVerifyUrl} target="_blank" rel="noopener noreferrer">
                      {t("verifyPsa")}<span className="prow-ext">{t("opensPsa")}</span>
                    </a>
                  ) : (
                    <span className="prow-chk">{t("onFile")}</span>
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
                  <span className="prow-k">{t("onChainToken")}</span>
                  <span className="prow-s">{chainLine}</span>
                </span>
                {d.explorerUrl ? (
                  <a className="prow-a" href={d.explorerUrl} target="_blank" rel="noopener noreferrer">
                    {t("viewOnChain")}<span className="prow-ext">{t("opensExplorer")}</span>
                  </a>
                ) : (
                  <span className="prow-chk">{t("tokenHash", { id: String(tokenId) })}</span>
                )}
              </div>
            </div>
          ) : tab === "history" ? (
            <div>
              {d.history.length === 0 && !d.tradesLoading ? (
                <p className="note">{t("noTrades")}</p>
              ) : null}
              {d.history.map((n) => (
                <div key={n.id} className={`hist-node${n.highlight ? " hl" : ""}`}>
                  <span className="hist-line" />
                  <span className={`hist-dot${n.you ? " you" : ""}`}>
                    <i />
                  </span>
                  <div className="hist-top">
                    <span className="hist-l">
                      {historyLabel(n.label, t)}
                      {n.you ? <span className="you-chip">{t("ownershipTransferred")}</span> : null}
                    </span>
                    {n.amount ? <span className="hist-amt">{n.amount}</span> : null}
                  </div>
                  <div className="hist-d">{localizeVaultText(n.detail, t)}</div>
                </div>
              ))}
              <p className="note">{t("historyNote")}</p>
            </div>
          ) : null}

          <div className="hair" />

          {tab === "pricing" ? (
            <PricingPanel data={d} paid={paid} costSource={costSource} />
          ) : null}

          {d.listed && d.listing?.priceUsd != null ? (
            <div className="pa-listings" data-listed-section="">
                <div className="prow">
                  <span className="prow-ic" aria-hidden>
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20.59 13.41 12 22l-9-9V4a1 1 0 0 1 1-1h9z" />
                      <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
                    </svg>
                  </span>
                  <span>
                    <span className="prow-k">{t("listedForSale")}</span>
                    <span className="prow-s">
                      {formatUsdListing(d.listing.priceUsd)}
                      {d.listing.createdAt
                        ? ` · ${t("listedOn", { date: formatCertDate(d.listing.createdAt, dates) })}`
                        : null}
                    </span>
                  </span>
                  {onCancelListing ? (
                    <button
                      type="button"
                      className="btn btn--subtle btn--sm"
                      disabled={
                        !d.isOwner ||
                        !d.canSign ||
                        d.redeemInFlight ||
                        cancelListingPending
                      }
                      onClick={onCancelListing}
                    >
                      {cancelListingPending ? t("cancelling") : t("cancelListing")}
                    </button>
                  ) : null}
                </div>
            </div>
          ) : null}

          <div className="cert-foot">
            <div className="mval">
              <span className="mval-k">{t("marketValue")}</span>
              <span className="mval-v">{formatUsdCompact(d.marketUsd)}</span>
              {chg ? (
                <span
                  className={`mval-chg${
                    chg.muted ? " mval-chg--muted" : chg.positive ? "" : " neg"
                  }`}
                >
                  {chg.arrow ? (
                    <span className="mval-chg__dir" aria-hidden>
                      {chg.arrow}
                    </span>
                  ) : null}
                  {chg.arrow ? " " : null}
                  {chg.label}
                </span>
              ) : null}
            </div>
            {d.listed && d.listing?.priceUsd != null ? (
              <div className="mval">
                <span className="mval-k">{t("listed")}</span>
                <span className="mval-v mval-v--listed">
                  {formatUsdListing(d.listing.priceUsd)}
                </span>
              </div>
            ) : null}
            <div className="foot-actions">
              {holdOnly ? null : (
              <button
                type="button"
                className="btn btn--subtle"
                disabled={
                  d.redeemBadge
                    ? false
                    : !d.isOwner || !d.canSign
                }
                title={
                  d.redeemBadge
                    ? redeemCopy(d.redeemBadge.label, t)
                    : d.listed
                      ? t("redeemCancels")
                      : !d.isOwner
                        ? t("ownerOnly")
                        : undefined
                }
                onClick={onRedeem}
              >
                {d.redeemBadge ? t("redemptionStatus") : t("redeem")}
              </button>
              )}
              <button
                type="button"
                className="btn btn--primary"
                disabled={!d.isOwner || !d.canSign || d.redeemInFlight}
                title={
                  d.redeemInFlight
                    ? t("redeemBlocksList")
                    : undefined
                }
                onClick={onSellList}
              >
                {d.listed ? t("editPrice") : t("sellList")}
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
          <span className="paz-hint">{t("zoomHint")}</span>
          {zoomSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={zoomImgRef}
              className={`paz-img${zoomed ? " zoomed" : ""}`}
              src={zoomSrc}
              alt={t("slabAlt")}
              style={zoomed ? { transform: "scale(2.1)" } : undefined}
              onMouseMove={(e) => {
                if (!zoomed) return;
                const img = e.currentTarget;
                const r = img.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width;
                const py = (e.clientY - r.top) / r.height;
                img.style.transformOrigin = `${px * 100}% ${py * 100}%`;
              }}
              onClick={(e) => {
                e.stopPropagation();
                setZoomed((prev) => !prev);
              }}
            />
          ) : null}
          <button
            type="button"
            className="paz-close"
            aria-label={t("close")}
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
                {t("front")}
              </button>
              <button
                type="button"
                className={`paz-tb${zoomFace === "back" ? " on" : ""}`}
                onClick={() => {
                  setZoomFace("back");
                  setZoomed(false);
                }}
              >
                {t("back")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
