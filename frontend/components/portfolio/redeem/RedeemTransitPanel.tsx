"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TkButton } from "@/components/ds";
import { cn } from "@/lib/ds/cn";
import type { RedeemShipmentView } from "@/lib/portfolio/buildRedeemShipments";
import {
  readRedeemShipmentReceived,
  writeRedeemShipmentReceived,
  type RedeemDraftCard,
} from "@/lib/portfolio/redeemDraft";
import { formatRedeemCardLine1FromDraft } from "@/lib/portfolio/portfolioTableHelpers";
import { buildCarrierTrackingUrl, formatCarrierLabel } from "@/lib/shipping/carrierTracking";

type ReportKind = "missing" | "damaged" | "wrong";

const REPORT_OPTIONS: { kind: ReportKind; label: string }[] = [
  { kind: "missing", label: "This card is missing from the box" },
  { kind: "damaged", label: "The slab arrived damaged" },
  { kind: "wrong", label: "This is not the card I expected" },
];

function minutesUntil(iso: string, nowMs = Date.now()): number | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.ceil((t - nowMs) / 60_000));
}

function formatEstDelivery(iso: string | null): string {
  if (!iso) return "Pending";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "Pending";
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "PSA 10 ×3 · BGS 9.5 ×1" — grades are full labels, so never assume PSA. */
function gradeSummary(cards: RedeemDraftCard[]): string {
  const counts = new Map<string, number>();
  for (const c of cards) {
    const label = c.grade?.trim() || "Ungraded";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, n]) => `${label} ×${n}`)
    .join(" · ");
}

function reportKey(shipmentKey: string, card: RedeemDraftCard): string {
  return `${shipmentKey}:${card.certNumber || card.tokenId}`;
}

/**
 * UI-only claim picker — no claim API yet. Local "Reported" state only;
 * real claim flow is deferred.
 */
function ReportProblemModal({
  card,
  onClose,
  onSubmit,
}: {
  card: RedeemDraftCard;
  onClose: () => void;
  onSubmit: (kind: ReportKind) => void;
}) {
  return (
    <div
      className="pf-redeem-report-scrim"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="pf-redeem-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pf-redeem-report-title"
      >
        <div className="pf-redeem-report-modal__eyebrow tkl-mono">
          Report a problem
        </div>
        <h2 id="pf-redeem-report-title" className="pf-redeem-report-modal__title">
          {formatRedeemCardLine1FromDraft(card)}
        </h2>
        <p className="pf-redeem-report-modal__meta tkl-mono">
          {card.certNumber ? `Cert #${card.certNumber}` : null}
        </p>
        <div className="pf-redeem-report-modal__opts">
          {REPORT_OPTIONS.map((opt) => (
            <TkButton
              key={opt.kind}
              type="button"
              variant="subtle"
              className="pf-redeem-report-modal__opt"
              onClick={() => onSubmit(opt.kind)}
            >
              {opt.label}
            </TkButton>
          ))}
        </div>
        <p className="pf-redeem-report-modal__note">
          We&rsquo;ll open a claim and hold this card&rsquo;s ownership in your
          account until it&rsquo;s resolved. Confirm the rest of the shipment as
          normal.
        </p>
        <TkButton
          type="button"
          variant="subtle"
          className="pf-redeem-report-modal__close"
          onClick={onClose}
        >
          Cancel
        </TkButton>
      </div>
    </div>
  );
}

/**
 * A shipment can hold up to 50 cards, so contents are a searchable itemised
 * list rather than a wall of thumbnails. The cert number is what the owner
 * checks each slab against.
 */
function ShipmentContents({
  shipment,
  reportedKeys,
  onReport,
}: {
  shipment: RedeemShipmentView;
  reportedKeys: Set<string>;
  onReport: (card: RedeemDraftCard) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const term = query.trim().toLowerCase();
  const matches = term
    ? shipment.cards.filter((c) =>
        `${c.certNumber ?? ""} ${formatRedeemCardLine1FromDraft(c)}`.toLowerCase().includes(term),
      )
    : shipment.cards;

  const note = term
    ? `${matches.length} of ${shipment.cardCount} cards match “${query.trim()}”`
    : shipment.cardCount > 6
      ? `Scroll for the full list · ${shipment.cardCount} cards`
      : "Check each slab against its cert number.";

  return (
    <div className="pf-redeem-contents">
      <div className="pf-redeem-contents__bar">
        <button
          type="button"
          className="pf-redeem-contents__tog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg
            className={cn(
              "pf-redeem-contents__caret",
              open && "pf-redeem-contents__caret--open",
            )}
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            aria-hidden
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
          Cards ({shipment.cardCount})
        </button>
      </div>

      {open ? (
        <div className="pf-redeem-contents__panel">
          <input
            type="search"
            className="pf-redeem-contents__search"
            placeholder="Search this shipment by cert or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={`Search shipment ${shipment.idx} contents`}
          />
          <ul className="pf-redeem-contents__list">
            {matches.map((c) => {
              const key = reportKey(shipment.shipmentKey, c);
              const reported = reportedKeys.has(key);
              return (
                <li key={c.tokenId} className="pf-redeem-contents__row">
                  <div className="pf-redeem-contents__thumb" aria-hidden>
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" />
                    ) : null}
                  </div>
                  <div className="pf-redeem-contents__info">
                    <div className="pf-redeem-contents__name">
                      {formatRedeemCardLine1FromDraft(c)}
                    </div>
                    <div className="pf-redeem-contents__meta">
                      {c.grade?.trim() ? (
                        <span className="pf-redeem-contents__grade tkl-mono">
                          {c.grade.trim()}
                        </span>
                      ) : null}
                      {c.certNumber ? (
                        <span className="pf-redeem-contents__cert tkl-mono">
                          Cert #{c.certNumber}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={cn(
                      "pf-redeem-flag",
                      reported && "pf-redeem-flag--reported",
                    )}
                    disabled={reported}
                    title={
                      reported
                        ? "Already reported"
                        : "Report this card missing or damaged"
                    }
                    onClick={() => onReport(c)}
                  >
                    {reported ? "Reported" : "Report"}
                  </button>
                </li>
              );
            })}
            {matches.length === 0 ? (
              <li className="pf-redeem-contents__empty">
                No cards in this shipment match that cert or name.
              </li>
            ) : null}
          </ul>
          <p className="pf-redeem-contents__note">{note}</p>
        </div>
      ) : null}
    </div>
  );
}

function ShipmentBox({
  shipment,
  locallyReceived,
  busy,
  reportedKeys,
  onReport,
  onMarkReceived,
}: {
  shipment: RedeemShipmentView;
  locallyReceived: boolean;
  busy: boolean;
  reportedKeys: Set<string>;
  onReport: (card: RedeemDraftCard) => void;
  onMarkReceived: () => void;
}) {
  const onWay = shipment.state === "on_the_way" || Boolean(shipment.trackingNumber);
  const trackUrl = buildCarrierTrackingUrl(
    shipment.trackingCarrier ?? undefined,
    shipment.trackingNumber ?? undefined,
  );
  const carrierLabel =
    formatCarrierLabel(shipment.trackingCarrier) ||
    (onWay ? "—" : "Pending");
  const trackingLabel = shipment.trackingNumber?.trim() || "Pending";
  const estDelivery = formatEstDelivery(shipment.carrierDeliveredAt);

  return (
    <div className="pf-redeem-shipment" data-shipment={shipment.shipmentKey}>
      <div className="pf-redeem-prep-row pf-redeem-shipment__head">
        <span className="pf-redeem-shipment__title" style={{ margin: 0 }}>
          Shipment {shipment.idx} · {shipment.vaultLabel} · {shipment.cardCount}{" "}
          card{shipment.cardCount === 1 ? "" : "s"}
        </span>
        <span
          className={`pf-redeem-status-pill tkl-mono ${
            locallyReceived
              ? "pf-redeem-status-pill--pos"
              : "pf-redeem-status-pill--warn"
          }`}
        >
          {locallyReceived ? "Received" : onWay ? "On the way" : "Preparing"}
        </span>
      </div>
      <div className="pf-redeem-cost__lines">
        <div className="pf-redeem-cost__line">
          <span className="pf-redeem-cost__label">Carrier</span>
          <span className="tkl-mono pf-redeem-cost__val">{carrierLabel}</span>
        </div>
        <div className="pf-redeem-cost__line">
          <span className="pf-redeem-cost__label">Tracking</span>
          {trackUrl ? (
            <a
              className="pf-redeem-track-link tkl-mono"
              href={trackUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {trackingLabel} →
            </a>
          ) : (
            <span className="tkl-mono pf-redeem-cost__val">{trackingLabel}</span>
          )}
        </div>
        <div className="pf-redeem-cost__line">
          <span className="pf-redeem-cost__label">Est. delivery</span>
          <span className="tkl-mono pf-redeem-cost__val">{estDelivery}</span>
        </div>
        {shipment.autoReceiptEligibleAt && !locallyReceived ? (
          <div className="pf-redeem-cost__line">
            <span className="pf-redeem-cost__label">Auto receipt</span>
            <span className="tkl-mono pf-redeem-cost__val">
              {(() => {
                const mins = minutesUntil(shipment.autoReceiptEligibleAt);
                return mins != null && mins > 0
                  ? `In ~${mins} min`
                  : "Pending next check";
              })()}
            </span>
          </div>
        ) : null}
        {shipment.cards.length > 0 ? (
          <div className="pf-redeem-cost__line">
            <span className="pf-redeem-cost__label">Grades</span>
            <span className="tkl-mono pf-redeem-cost__val">
              {gradeSummary(shipment.cards)}
            </span>
          </div>
        ) : null}
      </div>

      {shipment.cards.length > 0 ? (
        <ShipmentContents
          shipment={shipment}
          reportedKeys={reportedKeys}
          onReport={onReport}
        />
      ) : null}

      <TkButton
        type="button"
        variant="subtle"
        className="pf-redeem-ship-received"
        disabled={locallyReceived || busy}
        onClick={onMarkReceived}
      >
        {locallyReceived ? "Received" : busy ? "Confirming…" : "Mark this shipment received"}
      </TkButton>
    </div>
  );
}

export function RedeemTransitPanel({
  cards,
  shipments = [],
  busy = false,
  error = null,
  paymentBatchId,
  onConfirmReceived,
}: {
  cards: RedeemDraftCard[];
  shipments?: RedeemShipmentView[];
  busy?: boolean;
  error?: string | null;
  paymentBatchId?: string | null;
  onConfirmReceived?: () => void | Promise<boolean | void>;
  /** @deprecated use shipments */
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
}) {
  const list =
    shipments.length > 0
      ? shipments
      : cards.length > 0
        ? [
            {
              shipmentKey: "psa_vault",
              vaultLabel: cards[0]?.vaultLabel || "PSA Vault",
              idx: 1,
              cardCount: cards.length,
              cards,
              trackingNumber: null,
              trackingCarrier: null,
              carrierDeliveredAt: null,
              autoReceiptEligibleAt: null,
              state: "on_the_way" as const,
            },
          ]
        : [];

  const [reportedKeys, setReportedKeys] = useState<Set<string>>(() => new Set());
  const [localReceived, setLocalReceived] = useState<Set<string>>(
    () => new Set(readRedeemShipmentReceived(paymentBatchId ?? "")),
  );
  const [reportTarget, setReportTarget] = useState<{
    shipmentKey: string;
    card: RedeemDraftCard;
  } | null>(null);

  const trackedKeys = useMemo(
    () => list.map((s) => s.shipmentKey),
    [list],
  );
  const receivedCount = trackedKeys.filter((k) => localReceived.has(k)).length;
  const multiTracked = trackedKeys.length > 1;
  const canConfirm = Boolean(onConfirmReceived) && !busy;

  const persistPartial = (next: Set<string>) => {
    setLocalReceived(next);
    if (paymentBatchId) {
      writeRedeemShipmentReceived(paymentBatchId, [...next]);
    }
  };

  const markShipmentReceived = (shipmentKey: string) => {
    if (busy || localReceived.has(shipmentKey)) return;
    const next = new Set(localReceived).add(shipmentKey);
    const remaining = trackedKeys.filter((k) => !next.has(k));
    if (remaining.length === 0) {
      void onConfirmReceived?.();
      return;
    }
    persistPartial(next);
  };

  const confirmLabel = busy
    ? "Confirming…"
    : multiTracked && receivedCount > 0 && receivedCount < trackedKeys.length
      ? `I've received my cards (${receivedCount} of ${trackedKeys.length} shipments confirmed)`
      : "I've received my cards";

  return (
    <div className="pf-redeem-panel">
      <div className="pf-redeem-eyebrow">Redeem</div>
      <h1 className="pf-redeem-h1">Your cards are on their way</h1>
      <p className="pf-redeem-sub pf-redeem-sub--prep">
        Confirm once your cards arrive so we can close this request.
      </p>

      {list.map((sh) => (
        <ShipmentBox
          key={sh.shipmentKey}
          shipment={sh}
          locallyReceived={localReceived.has(sh.shipmentKey)}
          busy={busy}
          reportedKeys={reportedKeys}
          onReport={(card) =>
            setReportTarget({ shipmentKey: sh.shipmentKey, card })
          }
          onMarkReceived={() => markShipmentReceived(sh.shipmentKey)}
        />
      ))}

      <TkButton
        type="button"
        variant="primary"
        className="pf-redeem-primary"
        disabled={!canConfirm}
        onClick={() => onConfirmReceived?.()}
      >
        {confirmLabel}
      </TkButton>
      {error ? (
        <p className="pf-redeem-error" role="alert">
          {error}
        </p>
      ) : null}
      <Link href="/portfolio" className="pf-redeem-primary-link">
        <TkButton type="button" variant="subtle" className="pf-redeem-primary">
          Back to Portfolio
        </TkButton>
      </Link>

      {reportTarget ? (
        <ReportProblemModal
          card={reportTarget.card}
          onClose={() => setReportTarget(null)}
          onSubmit={() => {
            const key = reportKey(
              reportTarget.shipmentKey,
              reportTarget.card,
            );
            setReportedKeys((prev) => new Set(prev).add(key));
            setReportTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
