"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TkButton } from "@/components/ds";
import { cn } from "@/lib/ds/cn";
import type { RedeemShipmentView } from "@/lib/portfolio/buildRedeemShipments";
import {
  downloadRedeemManifest,
  type RedeemDraftCard,
} from "@/lib/portfolio/redeemDraft";
import { buildCarrierTrackingUrl } from "@/lib/psa/psaOrderProgressDisplay";

type ReportKind = "missing" | "damaged" | "wrong";

const REPORT_OPTIONS: { kind: ReportKind; label: string }[] = [
  { kind: "missing", label: "This card is missing from the box" },
  { kind: "damaged", label: "The slab arrived damaged" },
  { kind: "wrong", label: "This is not the card I expected" },
];

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
          {card.name}
        </h2>
        <p className="pf-redeem-report-modal__meta tkl-mono">
          {[card.grade, card.certNumber ? `Cert #${card.certNumber}` : null]
            .filter(Boolean)
            .join(" · ")}
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
          Claim opens soon. For now we mark this card locally so you can still
          confirm the rest of the shipment. Contact support if you need help
          right away.
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
  const [slipBusy, setSlipBusy] = useState(false);

  const term = query.trim().toLowerCase();
  const matches = term
    ? shipment.cards.filter((c) =>
        `${c.certNumber ?? ""} ${c.name}`.toLowerCase().includes(term),
      )
    : shipment.cards;

  const note = term
    ? `${matches.length} of ${shipment.cardCount} cards match “${query.trim()}”`
    : shipment.cardCount > 6
      ? `Scroll for the full list · ${shipment.cardCount} cards`
      : "Check each slab against its cert number.";

  const downloadSlip = async () => {
    setSlipBusy(true);
    try {
      await downloadRedeemManifest({
        idx: shipment.idx,
        vaultLabel: shipment.vaultLabel,
        cards: shipment.cards,
        trackingNumber: shipment.trackingNumber,
        trackingCarrier: shipment.trackingCarrier,
      });
    } finally {
      setSlipBusy(false);
    }
  };

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
          Contents ({shipment.cardCount})
        </button>
        <button
          type="button"
          className="pf-redeem-contents__slip"
          disabled={slipBusy}
          onClick={() => void downloadSlip()}
        >
          {slipBusy ? "Preparing…" : "View packing slip"}
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
                    <div className="pf-redeem-contents__name">{c.name}</div>
                    <div className="pf-redeem-contents__meta">
                      {c.grade ? (
                        <span className="pf-redeem-chip">{c.grade}</span>
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
  reportedKeys,
  onReport,
  onMarkReceived,
}: {
  shipment: RedeemShipmentView;
  locallyReceived: boolean;
  reportedKeys: Set<string>;
  onReport: (card: RedeemDraftCard) => void;
  onMarkReceived: () => void;
}) {
  const onWay = shipment.state === "on_the_way" || Boolean(shipment.trackingNumber);
  const trackUrl = buildCarrierTrackingUrl(
    shipment.trackingCarrier ?? undefined,
    shipment.trackingNumber ?? undefined,
  );
  const trackingLabel = shipment.trackingNumber?.trim() || "Pending";

  return (
    <div
      className={cn(
        "pf-redeem-shipment",
        locallyReceived && "pf-redeem-shipment--received",
      )}
      data-shipment={shipment.shipmentKey}
    >
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
      <div className="pf-redeem-shipment__meta tkl-mono">
        <div>
          <span className="pf-redeem-shipment__k">Carrier</span>
          <span>
            {shipment.trackingCarrier || (onWay ? "—" : "Pending")}
          </span>
        </div>
        <div>
          <span className="pf-redeem-shipment__k">Tracking</span>
          {trackUrl ? (
            <a
              className="pf-redeem-track-link"
              href={trackUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {trackingLabel}
            </a>
          ) : (
            <span>{trackingLabel}</span>
          )}
        </div>
        <div>
          <span className="pf-redeem-shipment__k">Est. delivery</span>
          <span>Pending</span>
        </div>
        {shipment.cards.length > 0 ? (
          <div>
            <span className="pf-redeem-shipment__k">Grades</span>
            <span>{gradeSummary(shipment.cards)}</span>
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

      <p className="pf-redeem-shipment__copy">
        {locallyReceived
          ? "Marked received on this device. Confirm below once every shipment has arrived."
          : onWay
            ? "This vault has shipped. Other vaults in the same order may still be preparing."
            : "Waiting for the vault to share a tracking number."}
      </p>

      {onWay && shipment.trackingNumber?.trim() && !locallyReceived ? (
        <TkButton
          type="button"
          variant="subtle"
          className="pf-redeem-ship-received"
          onClick={onMarkReceived}
        >
          Mark this shipment received
        </TkButton>
      ) : null}
    </div>
  );
}

export function RedeemTransitPanel({
  cards,
  shipments = [],
  busy = false,
  error = null,
  onConfirmReceived,
}: {
  cards: RedeemDraftCard[];
  shipments?: RedeemShipmentView[];
  busy?: boolean;
  error?: string | null;
  onConfirmReceived?: () => void;
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
              state: "on_the_way" as const,
            },
          ]
        : [];

  const [reportedKeys, setReportedKeys] = useState<Set<string>>(() => new Set());
  const [localReceived, setLocalReceived] = useState<Set<string>>(() => new Set());
  const [reportTarget, setReportTarget] = useState<{
    shipmentKey: string;
    card: RedeemDraftCard;
  } | null>(null);

  const trackedKeys = useMemo(
    () =>
      list
        .filter((s) => Boolean(s.trackingNumber?.trim()))
        .map((s) => s.shipmentKey),
    [list],
  );

  const allTracked =
    list.length > 0 &&
    list.every((s) => Boolean(s.trackingNumber?.trim()));
  const receivedCount = trackedKeys.filter((k) => localReceived.has(k)).length;
  const multiTracked = trackedKeys.length > 1;
  const canConfirm = allTracked && Boolean(onConfirmReceived) && !busy;

  const confirmLabel = busy
    ? "Confirming…"
    : multiTracked
      ? `I've received my cards (${receivedCount} of ${trackedKeys.length})`
      : "I've received my cards";

  return (
    <div className="pf-redeem-panel">
      <div className="pf-redeem-banner pf-redeem-banner--azure">
        <svg
          className="pf-redeem-banner__icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
        <div>
          <strong>Your cards are on their way</strong>
          <p>
            Confirm once your cards arrive so we can close this request.
            {list.length > 1
              ? " Each vault ships separately with its own tracking."
              : ""}
          </p>
        </div>
      </div>

      {list.map((sh) => (
        <ShipmentBox
          key={sh.shipmentKey}
          shipment={sh}
          locallyReceived={localReceived.has(sh.shipmentKey)}
          reportedKeys={reportedKeys}
          onReport={(card) =>
            setReportTarget({ shipmentKey: sh.shipmentKey, card })
          }
          onMarkReceived={() =>
            setLocalReceived((prev) => new Set(prev).add(sh.shipmentKey))
          }
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
        <p className="pf-redeem-cost__copy" style={{ textAlign: "center", color: "var(--neg, #c00)" }}>
          {error}
        </p>
      ) : !allTracked ? (
        <p className="pf-redeem-cost__copy" style={{ textAlign: "center" }}>
          Available once every vault shipment has a tracking number.
        </p>
      ) : multiTracked && receivedCount < trackedKeys.length ? (
        <p className="pf-redeem-cost__copy" style={{ textAlign: "center" }}>
          You can still confirm the whole order when every package has arrived —
          per-shipment marks are only a checklist on this device.
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
