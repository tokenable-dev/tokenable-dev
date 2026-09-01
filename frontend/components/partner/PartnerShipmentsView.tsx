"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TkButton, TkField, TkInput, TkSelect } from "@/components/ds";
import {
  listPartnerRedeems,
  patchPartnerRedeemBatchTracking,
  rq,
} from "@/lib/core";
import { PARTNER_PORTFOLIO_PATH } from "@/lib/portfolio/portfolioPaths";
import {
  groupPartnerRedeems,
  type PartnerShipmentTab,
} from "@/lib/partner/partnerRedeemGroups";
import {
  formatPartnerRedeemRequestedAt,
  isPartnerRedeemDueSoon,
  partnerRedeemDeadlineCountdown,
  partnerRedeemDueSoonBannerText,
} from "@/lib/partner/partnerRedeemStats";
import {
  PARTNER_SHIPMENT_STATUS,
  partnerCardCertLine,
  partnerCardImageUrl,
  partnerShipmentStatusKey,
  partnerShipToAddressLines,
  partnerShipToCity,
  partnerTrackingUrl,
  sortPartnerShipmentGroups,
} from "@/lib/partner/partnerShipmentDisplay";
import { formatCarrierLabel } from "@/lib/shipping/carrierTracking";
import { usePartnerRedeemMetadataImages } from "@/hooks/partner/usePartnerRedeemMetadataImages";
import type { PartnerRedeemRow } from "@/lib/core";

type TabId = PartnerShipmentTab;
type ShipmentGroup = ReturnType<typeof groupPartnerRedeems>[number];

const TABS: { id: TabId; label: string }[] = [
  { id: "to_ship", label: "To ship" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

const CARRIERS = [
  { value: "fedex", label: "FedEx" },
  { value: "ups", label: "UPS" },
  { value: "dhl", label: "DHL" },
  { value: "usps", label: "USPS" },
  { value: "other", label: "Other" },
];

function TrackingModal({
  group,
  metadataImages,
  onClose,
  onSaved,
}: {
  group: ShipmentGroup;
  metadataImages: ReadonlyMap<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [trackingNumber, setTrackingNumber] = useState(
    group.trackingNumber ?? "",
  );
  const [carrier, setCarrier] = useState(
    group.trackingCarrier?.toLowerCase() || "fedex",
  );
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(group.trackingNumber?.trim());

  const mutation = useMutation({
    mutationFn: () =>
      patchPartnerRedeemBatchTracking({
        batchId: group.paymentBatchId,
        shipmentKey: group.shipmentKey,
        redemptionIds: group.items
          .filter(
            (row) =>
              row.status !== "completed" &&
              row.status !== "cancelled" &&
              row.status !== "refunded" &&
              row.status !== "failed",
          )
          .map((row) => row.id),
        trackingNumber: trackingNumber.trim(),
        trackingCarrier: carrier === "other" ? undefined : carrier,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to save tracking");
    },
  });

  const deadline = partnerRedeemDeadlineCountdown(
    group.requestedAt,
    group.tab === "to_ship",
  );

  return (
    <div
      className="partner-ship-modal-scrim"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="partner-ship-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-ship-modal-title"
      >
        <div className="partner-ship-modal__head">
          <div>
            <h2 id="partner-ship-modal-title" className="partner-ship-modal__title">
              {isEdit ? "Edit tracking" : "Add tracking"}
            </h2>
            <p className="partner-ship-modal__copy">
              The buyer will see this and can track their shipment.
            </p>
          </div>
          <button
            type="button"
            className="partner-ship__iconbtn"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="partner-ship-modal__panel">
          <div className="partner-ship-modal__eyebrow tkl-mono">
            In this shipment{" "}
            <span className="partner-ship-modal__count">
              ({group.items.length} card{group.items.length === 1 ? "" : "s"})
            </span>
          </div>
          <ul className="partner-ship-modal__cards">
            {group.items.map((item) => (
              <li key={item.id} className="partner-ship__cardcell">
                <CardThumb
                  item={item}
                  metadataImages={metadataImages}
                  className="partner-ship__thumb--sm"
                />
                <span className="partner-ship__cardtext">
                  <span className="partner-ship__cname partner-ship__cname--sm">
                    {item.displayName || `Token #${item.tokenId}`}
                  </span>
                  {partnerCardCertLine(item) ? (
                    <span className="partner-ship__cid tkl-mono">
                      {partnerCardCertLine(item)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="partner-ship-modal__hint">
            One tracking number covers the whole shipment.
          </p>
          <hr className="partner-ship-modal__rule" />
          <div className="partner-ship-modal__eyebrow tkl-mono">Ship to</div>
          <div className="partner-ship-modal__addr">
            {partnerShipToAddressLines(group).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <div className="partner-ship-modal__deadline">
            <span className="partner-ship-modal__eyebrow tkl-mono">Deadline</span>
            <span
              className={`partner-ship__dl tkl-mono${deadline.warn ? " partner-ship__dl--warn" : ""}`}
            >
              {deadline.text}
            </span>
          </div>
        </div>

        <div className="partner-ship-modal__fields">
          <TkField label="Carrier" htmlFor="partner-ship-carrier">
            <TkSelect
              id="partner-ship-carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            >
              {CARRIERS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </TkSelect>
          </TkField>
          <TkField
            label="Tracking number"
            htmlFor="partner-ship-tracking"
            error={error || undefined}
          >
            <TkInput
              id="partner-ship-tracking"
              value={trackingNumber}
              placeholder="e.g. 1Z999AA10123456784"
              hasError={Boolean(error)}
              onChange={(e) => {
                setTrackingNumber(e.target.value);
                setError(null);
              }}
            />
          </TkField>
        </div>

        <div className="partner-ship-modal__callout">
          <UrgencyIcon />
          <span>
            {isEdit
              ? "Editing the tracking number does not reverse the cancellation lock — the buyer still cannot cancel this redemption."
              : "Once you add tracking, the buyer can no longer cancel this redemption. Make sure the parcel is on its way."}
          </span>
        </div>

        <div className="partner-ship-modal__actions">
          <TkButton type="button" variant="subtle" onClick={onClose}>
            Cancel
          </TkButton>
          <TkButton
            type="button"
            variant="primary"
            disabled={!trackingNumber.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? "Saving…"
              : isEdit
                ? "Save tracking"
                : "Add tracking and mark shipped"}
          </TkButton>
        </div>
      </div>
    </div>
  );
}

function UrgencyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="7" x2="12" y2="13" />
      <line x1="12" y1="16.5" x2="12" y2="16.5" />
    </svg>
  );
}

function EmptyCheckIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--pos, rgb(0, 200, 100))"
      strokeWidth="2.5"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

function CardThumb({
  item,
  metadataImages,
  className = "",
}: {
  item: PartnerRedeemRow;
  metadataImages: ReadonlyMap<string, string>;
  className?: string;
}) {
  const src = partnerCardImageUrl(item, metadataImages);
  return (
    <span
      className={`partner-ship__thumb${src ? "" : " partner-ship__thumb--empty"}${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      {src ? <img src={src} alt="" /> : null}
    </span>
  );
}

function ShipmentSkeletonRows() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className="partner-ship__trow">
          {[70, 60, 50, 40, 50, 70].map((w, j) => (
            <div
              key={j}
              className="partner-ship__skel"
              style={{ width: `${w - i * 5}%` }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function ShipmentRow({
  group,
  expanded,
  menuOpen,
  metadataImages,
  onToggleExpand,
  onToggleMenu,
  onEnterTracking,
}: {
  group: ShipmentGroup;
  expanded: boolean;
  menuOpen: boolean;
  metadataImages: ReadonlyMap<string, string>;
  onToggleExpand: () => void;
  onToggleMenu: () => void;
  onEnterTracking: () => void;
}) {
  const first = group.items[0]!;
  const extra = group.items.length - 1;
  const statusKey = partnerShipmentStatusKey(group);
  const status = PARTNER_SHIPMENT_STATUS[statusKey];
  const soon =
    group.tab === "to_ship" && isPartnerRedeemDueSoon(group.requestedAt);
  const deadline = partnerRedeemDeadlineCountdown(
    group.requestedAt,
    group.tab === "to_ship",
  );
  const shipName = first.shipTo.name;
  const shipCity = partnerShipToCity(group);
  const showTrackingMeta =
    (group.tab === "shipped" || group.tab === "delivered") &&
    Boolean(group.trackingNumber?.trim());
  const showRowMenu =
    group.tab === "to_ship" ||
    group.tab === "shipped" ||
    group.tab === "delivered";
  // Partner-Shipments.html: Edit tracking only while still shipped (not delivered).
  const canEditTracking = group.tab === "shipped";
  const trackingHref =
    showTrackingMeta && group.trackingNumber
      ? partnerTrackingUrl(group.trackingCarrier, group.trackingNumber)
      : null;
  const carrierShown = formatCarrierLabel(group.trackingCarrier);

  return (
    <>
      <div
        className={`partner-ship__trow${soon ? " partner-ship__trow--soon" : ""}${menuOpen ? " partner-ship__trow--menu-open" : ""}`}
      >
        <div className="partner-ship__cardcell">
          <CardThumb item={first} metadataImages={metadataImages} />
          <span className="partner-ship__cardtext">
            <span className="partner-ship__cname">
              {first.displayName || `Token #${first.tokenId}`}
            </span>
            {partnerCardCertLine(first) ? (
              <span className="partner-ship__cid tkl-mono">
                {partnerCardCertLine(first)}
              </span>
            ) : null}
            {extra > 0 ? (
              <button
                type="button"
                className="partner-ship__more tkl-mono"
                onClick={onToggleExpand}
              >
                {expanded ? "Hide" : `＋${extra} more`}
              </button>
            ) : null}
          </span>
        </div>

        <div>
          <span className="partner-ship__cellk tkl-mono">Ship to</span>
          <span className="partner-ship__v">{shipName}</span>
          {shipCity ? <span className="partner-ship__vs">{shipCity}</span> : null}
        </div>

        <div>
          <span className="partner-ship__cellk tkl-mono">Requested</span>
          <span className="partner-ship__v partner-ship__v--mono tkl-mono">
            {formatPartnerRedeemRequestedAt(group.requestedAt)}
          </span>
        </div>

        <div>
          <span className="partner-ship__cellk tkl-mono">Deadline</span>
          <span
            className={`partner-ship__dl tkl-mono${deadline.warn ? " partner-ship__dl--warn" : ""}`}
          >
            {deadline.text}
          </span>
        </div>

        <div>
          <span className="partner-ship__cellk tkl-mono">Status</span>
          <span
            className="partner-ship__status-pill tkl-mono"
            style={{ background: status.bg, color: status.fg }}
          >
            {status.label}
          </span>
        </div>

        <div>
          <div className="partner-ship__action">
            {group.tab === "to_ship" ? (
              <>
                <TkButton
                  type="button"
                  variant="primary"
                  size="sm"
                  className="partner-ship__enter-btn"
                  onClick={onEnterTracking}
                >
                  Enter tracking
                </TkButton>
                <RowMenu
                  open={menuOpen}
                  onToggle={onToggleMenu}
                  onViewAddress={onToggleExpand}
                  onEditTracking={
                    group.trackingNumber ? onEnterTracking : undefined
                  }
                />
              </>
            ) : showTrackingMeta || showRowMenu ? (
              <>
                {showTrackingMeta && group.trackingNumber ? (
                  <span className="partner-ship__track-meta">
                    <span className="partner-ship__v">
                      {carrierShown || "—"}
                    </span>
                    <span className="partner-ship__vs">
                      {trackingHref ? (
                        <a
                          className="tkl-mono"
                          href={trackingHref}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {group.trackingNumber} →
                        </a>
                      ) : (
                        <span className="tkl-mono">{group.trackingNumber}</span>
                      )}
                    </span>
                  </span>
                ) : null}
                {showRowMenu ? (
                  <RowMenu
                    open={menuOpen}
                    onToggle={onToggleMenu}
                    onViewAddress={onToggleExpand}
                    onEditTracking={
                      canEditTracking ? onEnterTracking : undefined
                    }
                  />
                ) : null}
              </>
            ) : (
              <span className="partner-ship__vs">No action needed</span>
            )}
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="partner-ship__expand partner-ship__expand--open">
          <div className="partner-ship__kv">
            <b>Ship to</b>
            <span>
              {partnerShipToAddressLines(group).map((line, i) => (
                <span key={line}>
                  {i > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </span>
          </div>
          {extra > 0 ? (
            <ul className="partner-ship__expand-cards">
              {group.items.slice(1).map((item) => (
                <li key={item.id} className="partner-ship__cardcell">
                  <CardThumb
                    item={item}
                    metadataImages={metadataImages}
                    className="partner-ship__thumb--xs"
                  />
                  <span className="partner-ship__cardtext">
                    <span className="partner-ship__cname partner-ship__cname--sm">
                      {item.displayName || `Token #${item.tokenId}`}
                    </span>
                    {partnerCardCertLine(item) ? (
                      <span className="partner-ship__cid tkl-mono">
                        {partnerCardCertLine(item)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function RowMenu({
  open,
  onToggle,
  onViewAddress,
  onEditTracking,
}: {
  open: boolean;
  onToggle: () => void;
  onViewAddress: () => void;
  onEditTracking?: () => void;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onToggle();
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open, onToggle]);

  return (
    <span className="partner-ship__menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="partner-ship__iconbtn"
        aria-label="More actions"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <KebabIcon />
      </button>
      {open ? (
        <span className="partner-ship__menu partner-ship__menu--open" role="menu">
          <button
            type="button"
            className="partner-ship__menu-item"
            role="menuitem"
            onClick={() => {
              onViewAddress();
              onToggle();
            }}
          >
            View address
          </button>
          {onEditTracking ? (
            <button
              type="button"
              className="partner-ship__menu-item"
              role="menuitem"
              onClick={() => {
                onEditTracking();
                onToggle();
              }}
            >
              Edit tracking
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/** Partner-Shipments.html — redeem requests queue + tracking entry. */
export function PartnerShipmentsView() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>("to_ship");
  const [editing, setEditing] = useState<ShipmentGroup | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);

  const query = useQuery({
    queryKey: rq.partnerRedeems(),
    queryFn: () => listPartnerRedeems({ limit: 100 }),
    staleTime: 10_000,
  });

  const groups = useMemo(
    () => groupPartnerRedeems(query.data?.items ?? []),
    [query.data?.items],
  );

  const metadataImages = usePartnerRedeemMetadataImages(query.data?.items ?? []);

  const filtered = useMemo(() => {
    const list = tab === "all" ? groups : groups.filter((g) => g.tab === tab);
    return sortPartnerShipmentGroups(list);
  }, [groups, tab]);

  const counts = useMemo(() => {
    const c: Record<TabId, number> = {
      to_ship: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      all: groups.length,
    };
    for (const g of groups) c[g.tab] += 1;
    return c;
  }, [groups]);

  const toShipGroups = useMemo(
    () => groups.filter((g) => g.tab === "to_ship"),
    [groups],
  );

  const dueSoonCount = useMemo(
    () => toShipGroups.filter((g) => isPartnerRedeemDueSoon(g.requestedAt)).length,
    [toShipGroups],
  );

  const showToShipEmpty = !query.isLoading && filtered.length === 0 && tab === "to_ship";

  return (
    <div className="partner-redeem-page tkl-wrap">
      <nav className="partner-redeem-page__breadcrumb tkl-mono" aria-label="Breadcrumb">
        <Link href={PARTNER_PORTFOLIO_PATH}>Portfolio</Link>
        <span className="partner-redeem-page__breadcrumb-sep" aria-hidden>
          /
        </span>
        <span>Redeem requests</span>
      </nav>

      <div className="partner-redeem-page__head">
        <div className="partner-redeem-page__head-copy">
          <h1 className="partner-redeem-page__title">Redeem requests</h1>
          <p className="partner-redeem-page__sub">
            Buyers redeeming cards you hold. Ship each one and add tracking within 5 days.
          </p>
        </div>
        <div className="partner-redeem-page__pills" aria-label="Shipment summary">
          <span className="partner-redeem-page__pill partner-redeem-page__pill--neutral tkl-mono">
            <span>{counts.to_ship}</span>
            &nbsp;to ship
          </span>
          {dueSoonCount > 0 ? (
            <span className="partner-redeem-page__pill partner-redeem-page__pill--soon tkl-mono">
              <span>{dueSoonCount}</span>
              &nbsp;due soon
            </span>
          ) : null}
        </div>
      </div>

      {dueSoonCount > 0 ? (
        <div className="partner-redeem-page__banner" role="status">
          <UrgencyIcon />
          <span>{partnerRedeemDueSoonBannerText(dueSoonCount)}</span>
        </div>
      ) : null}

      <div className="partner-ship">
        <div className="partner-ship__tabs" role="tablist" aria-label="Shipment status">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`partner-ship__tab${tab === t.id ? " partner-ship__tab--on" : ""}`}
              onClick={() => {
                setTab(t.id);
                setExpandedKey(null);
                setMenuKey(null);
              }}
            >
              {t.label}
              <span className="partner-ship__tab-count">{counts[t.id]}</span>
            </button>
          ))}
        </div>

        <div className="partner-ship__tbl">
          <div className="partner-ship__thead" aria-hidden={query.isLoading}>
            <span className="partner-ship__th tkl-mono">Card</span>
            <span className="partner-ship__th tkl-mono">Ship to</span>
            <span className="partner-ship__th tkl-mono">Requested</span>
            <span className="partner-ship__th tkl-mono">Deadline</span>
            <span className="partner-ship__th tkl-mono">Status</span>
            <span className="partner-ship__th partner-ship__th--action tkl-mono">
              Action
            </span>
          </div>

          <div className="partner-ship__rows">
            {query.isLoading ? (
              <ShipmentSkeletonRows />
            ) : filtered.length === 0 ? null : (
              filtered.map((g) => (
                <ShipmentRow
                  key={g.key}
                  group={g}
                  expanded={expandedKey === g.key}
                  menuOpen={menuKey === g.key}
                  metadataImages={metadataImages}
                  onToggleExpand={() =>
                    setExpandedKey((k) => (k === g.key ? null : g.key))
                  }
                  onToggleMenu={() =>
                    setMenuKey((k) => (k === g.key ? null : g.key))
                  }
                  onEnterTracking={() => setEditing(g)}
                />
              ))
            )}
          </div>

          {query.isError ? (
            <div className="partner-ship__empty">
              Couldn&apos;t load your shipments.{" "}
              <button
                type="button"
                className="partner-ship__retry tkl-mono"
                onClick={() => void query.refetch()}
              >
                Retry
              </button>
            </div>
          ) : showToShipEmpty ? (
            <div className="partner-ship__empty">
              <div className="partner-ship__empty-icon" aria-hidden>
                <EmptyCheckIcon />
              </div>
              <div className="partner-ship__empty-title">
                All caught up — nothing to ship right now.
              </div>
              <div className="partner-ship__empty-sub">
                New redemption requests will appear here.
              </div>
            </div>
          ) : !query.isLoading && filtered.length === 0 ? (
            <div className="partner-ship__empty">
              <div className="partner-ship__empty-title">Nothing here yet.</div>
            </div>
          ) : null}
        </div>
      </div>

      {editing ? (
        <TrackingModal
          group={editing}
          metadataImages={metadataImages}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void qc.invalidateQueries({
              queryKey: rq.partnerRedeems(),
            });
          }}
        />
      ) : null}
    </div>
  );
}
