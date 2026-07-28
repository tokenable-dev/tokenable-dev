"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VaultThumb } from "@/components/vault/VaultThumb";
import {
  listVaultSubmissions,
  type VaultSubmissionApi,
} from "@/lib/core/api/vault-submissions";
import {
  CARRIER_LABELS,
  CARRIER_TRACK_URLS,
  sellSubmissionResumeHref,
  type SellCarrier,
} from "@/lib/sell/sellFlowDraft";
import type { VaultInProgressItem } from "@/lib/vault/vaultHubTypes";
import { cn } from "@/lib/ds/cn";

function packageMeta(items: VaultSubmissionApi["items"]) {
  const card = items[0];
  const cardCount = items.length;
  return {
    name: card?.name?.trim() || card?.cert || "Submission",
    grade: card?.grade ?? "—",
    imageUrl: card?.imageUrl ?? "",
    cardCount,
  };
}

function apiToInProgress(s: VaultSubmissionApi): VaultInProgressItem | null {
  if (s.status === "cancelled" || s.status === "completed") return null;
  if (!["awaiting_shipment", "in_transit", "psa_reviewing", "draft"].includes(s.status)) {
    return null;
  }

  const meta = packageMeta(s.items);
  const carrier = (s.carrier ?? "fedex") as SellCarrier;
  const resumeHref = sellSubmissionResumeHref(s.status, s.publicId);

  if (s.status === "draft") {
    return {
      id: s.publicId,
      ...meta,
      statusKind: "action-needed",
      statusLabel: "Draft",
      detail: `${meta.cardCount} card${meta.cardCount === 1 ? "" : "s"} saved`,
      actionNeeded: true,
      cta: { label: "Continue", href: resumeHref, primary: true },
    };
  }

  if (s.status === "awaiting_shipment") {
    return {
      id: s.publicId,
      ...meta,
      statusKind: "action-needed",
      statusLabel: "Shipping to vault",
      detail: "Tracking number required",
      actionNeeded: true,
      cta: { label: "Add tracking", href: "/sell/shipping", primary: true },
    };
  }

  if (s.status === "in_transit") {
    return {
      id: s.publicId,
      ...meta,
      statusKind: "in-transit",
      statusLabel: "Shipping to vault",
      detail:
        s.trackingNumber && s.carrier
          ? `${CARRIER_LABELS[carrier] ?? s.carrier} · ${s.trackingNumber}`
          : undefined,
      trackingUrl:
        s.trackingNumber && s.carrier
          ? `${CARRIER_TRACK_URLS[carrier] ?? ""}${encodeURIComponent(s.trackingNumber)}`
          : undefined,
      cta: {
        label: "Track",
        href: `/vault/submissions/${encodeURIComponent(s.publicId)}`,
        primary: false,
      },
    };
  }

  return {
    id: s.publicId,
    ...meta,
    statusKind: "reviewing",
    statusLabel: "PSA Review",
    detail: "PSA is authenticating",
    cta: {
      label: "View",
      href: `/vault/submissions/${encodeURIComponent(s.publicId)}`,
      primary: false,
    },
  };
}

function statusDotClass(kind: VaultInProgressItem["statusKind"]): string {
  if (kind === "action-needed") return "vault-status-dot--amber";
  if (kind === "in-transit" || kind === "reviewing" || kind === "minting") {
    return "vault-status-dot--azure";
  }
  return "vault-status-dot--pos";
}

function statusLabelClass(kind: VaultInProgressItem["statusKind"]): string {
  if (kind === "action-needed") return "vault-ip-card__status-label--amber";
  if (kind === "in-transit" || kind === "reviewing" || kind === "minting") {
    return "vault-ip-card__status-label--azure";
  }
  return "vault-ip-card__status-label--pos";
}

/** Server-backed sell submissions as hub In Progress (no offline mock cards). */
export function VaultHubInProgressFromShipment() {
  const [items, setItems] = useState<VaultInProgressItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listVaultSubmissions();
        if (cancelled) return;
        setItems(
          rows
            .map(apiToInProgress)
            .filter((x): x is VaultInProgressItem => Boolean(x)),
        );
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  const inProgressCount = items.filter(
    (i) => i.statusKind !== "token-sent",
  ).length;

  return (
    <section className="vault-hub-section">
      <div className="vault-hub-stat-grid">
        <div className="vault-hub-stat-card">
          <div className="vault-hub-stat-card__label">In progress</div>
          <div className="vault-hub-stat-card__num vault-hub-stat-card__num--azure">
            {inProgressCount}
          </div>
          <div className="vault-hub-stat-card__sub">Shipping &amp; review</div>
        </div>
        <div className="vault-hub-stat-card">
          <div className="vault-hub-stat-card__label">Added to portfolio</div>
          <div className="vault-hub-stat-card__num vault-hub-stat-card__num--pos">0</div>
          <div className="vault-hub-stat-card__sub">Completed</div>
        </div>
        <div className="vault-hub-stat-card">
          <div className="vault-hub-stat-card__label">Rejected</div>
          <div className="vault-hub-stat-card__num vault-hub-stat-card__num--neg">0</div>
          <div className="vault-hub-stat-card__sub">Returned</div>
        </div>
      </div>

      <div className="vault-ip-grid">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "vault-ip-card",
              item.actionNeeded && "vault-ip-card--action",
            )}
          >
            <div className="vault-ip-card__top">
              <div className="vault-ip-card__thumb">
                <VaultThumb src={item.imageUrl} width={56} height={78} />
                {item.cardCount > 1 ? (
                  <span className="vault-ip-card__thumb-count" aria-hidden>
                    {item.cardCount}
                  </span>
                ) : null}
              </div>
              <div className="vault-ip-card__info">
                <div className="vault-ip-card__name-row">
                  <div className="vault-ip-card__name">{item.name}</div>
                  {item.cardCount > 1 ? (
                    <span className="vault-ip-card__more">
                      +{item.cardCount - 1} more
                    </span>
                  ) : null}
                </div>
                <div className="vault-ip-card__status">
                  <span className={cn("vault-status-dot", statusDotClass(item.statusKind))} />
                  <span
                    className={cn(
                      "vault-ip-card__status-label",
                      statusLabelClass(item.statusKind),
                    )}
                  >
                    {item.statusLabel}
                  </span>
                  {item.detail && item.trackingUrl ? (
                    <a
                      href={item.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono vault-ip-card__tracking-link"
                    >
                      {item.detail} →
                    </a>
                  ) : item.detail ? (
                    <span className="vault-ip-card__detail-text">{item.detail}</span>
                  ) : null}
                  <span className="vault-hub-grade-badge">{item.grade}</span>
                </div>
              </div>
            </div>
            <div className="vault-ip-card__bottom">
              <Link
                href={item.cta.href}
                className={cn(
                  "vault-hub-cta-link tk-btn tk-btn--sm",
                  item.cta.primary ? "tk-btn--primary" : "tk-btn--subtle",
                )}
              >
                {item.cta.label} →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function useHasSellShipment(): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listVaultSubmissions();
        if (cancelled) return;
        setHas(
          rows.some(
            (r) =>
              r.status === "draft" ||
              r.status === "awaiting_shipment" ||
              r.status === "in_transit" ||
              r.status === "psa_reviewing",
          ),
        );
      } catch {
        if (!cancelled) setHas(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return has;
}
