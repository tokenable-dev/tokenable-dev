"use client";

import Link from "next/link";
import { TkButton } from "@/components/ds";
import type { RedeemShipmentView } from "@/lib/portfolio/buildRedeemShipments";
import { RedeemCardSummary } from "./RedeemCardSummary";
import type { RedeemDraftCard } from "@/lib/portfolio/redeemDraft";

function ShipmentBox({ shipment }: { shipment: RedeemShipmentView }) {
  const onWay = shipment.state === "on_the_way";
  return (
    <div className="pf-redeem-shipment" data-shipment={shipment.shipmentKey}>
      <div className="pf-redeem-prep-row" style={{ marginBottom: 12 }}>
        <span className="pf-redeem-shipment__title" style={{ margin: 0 }}>
          Shipment {shipment.idx} · {shipment.vaultLabel} ({shipment.cardCount}{" "}
          card{shipment.cardCount === 1 ? "" : "s"})
        </span>
        <span
          className={`pf-redeem-status-pill tkl-mono ${
            onWay
              ? "pf-redeem-status-pill--warn"
              : "pf-redeem-status-pill--warn"
          }`}
        >
          {onWay ? "On the way" : "Preparing"}
        </span>
      </div>
      {shipment.cards.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <RedeemCardSummary cards={shipment.cards} />
        </div>
      ) : null}
      <div className="pf-redeem-shipment__meta tkl-mono">
        <div>
          <span className="pf-redeem-shipment__k">Carrier</span>
          <span>
            {shipment.trackingCarrier || (onWay ? "—" : "Pending")}
          </span>
        </div>
        <div>
          <span className="pf-redeem-shipment__k">Tracking</span>
          <span>{shipment.trackingNumber || "Pending"}</span>
        </div>
        <div>
          <span className="pf-redeem-shipment__k">Est. delivery</span>
          <span>Pending</span>
        </div>
      </div>
      <p className="pf-redeem-shipment__copy">
        {onWay
          ? "This vault has shipped. Other vaults in the same order may still be preparing."
          : "Waiting for the vault to share a tracking number."}
      </p>
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

  const allTracked =
    list.length > 0 &&
    list.every((s) => Boolean(s.trackingNumber?.trim()));
  const canConfirm = allTracked && Boolean(onConfirmReceived) && !busy;

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
            Confirm once your cards arrive so we can complete the redemption.
            {list.length > 1
              ? " Each vault ships separately with its own tracking."
              : ""}
          </p>
        </div>
      </div>

      {list.map((sh) => (
        <ShipmentBox key={sh.shipmentKey} shipment={sh} />
      ))}

      <TkButton
        type="button"
        variant="primary"
        className="pf-redeem-primary"
        disabled={!canConfirm}
        onClick={() => onConfirmReceived?.()}
      >
        {busy ? "Confirming…" : "I've received my cards"}
      </TkButton>
      {error ? (
        <p className="pf-redeem-cost__copy" style={{ textAlign: "center", color: "var(--neg, #c00)" }}>
          {error}
        </p>
      ) : !allTracked ? (
        <p className="pf-redeem-cost__copy" style={{ textAlign: "center" }}>
          Available once every vault shipment has a tracking number.
        </p>
      ) : null}
      <Link href="/portfolio" className="pf-redeem-primary-link">
        <TkButton type="button" variant="subtle" className="pf-redeem-primary">
          Back to Portfolio
        </TkButton>
      </Link>
    </div>
  );
}
