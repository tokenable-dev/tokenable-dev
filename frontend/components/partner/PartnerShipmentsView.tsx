"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
} from "@/lib/partner/partnerRedeemStats";
import { useCatalogNameRevision } from "@/lib/marketplace/catalogNameTranslation";
import {
  type PartnerShipmentStatusKey,
  partnerCardCertLine,
  partnerCardImageUrl,
  partnerRedeemCardTitle,
  partnerShipmentStatusKey,
  partnerShipToAddressLines,
  partnerShipToCity,
  partnerTrackingUrl,
  sortPartnerShipmentGroups,
} from "@/lib/partner/partnerShipmentDisplay";
import { formatCarrierLabel } from "@/lib/shipping/carrierTracking";
import {
  usePartnerRedeemMetadata,
} from "@/hooks/partner/usePartnerRedeemMetadataImages";
import type { PartnerRedeemRow, RwaMetadata } from "@/lib/core";
import { useToastStore } from "@/store/toastStore";

type TabId = PartnerShipmentTab;
type ShipmentGroup = ReturnType<typeof groupPartnerRedeems>[number];

const TAB_IDS: TabId[] = ["to_ship", "shipped", "delivered", "cancelled", "all"];

const INLINE_CARRIERS = [
  { value: "fedex", label: "FedEx" },
  { value: "ups", label: "UPS" },
  { value: "dhl", label: "DHL" },
];

const MODAL_CARRIERS = [
  { value: "dhl", label: "DHL" },
  { value: "fedex", label: "FedEx" },
  { value: "ups", label: "UPS" },
];

function openRedemptionIds(group: ShipmentGroup): string[] {
  return group.items
    .filter(
      (row) =>
        row.status !== "completed" &&
        row.status !== "cancelled" &&
        row.status !== "refunded" &&
        row.status !== "failed",
    )
    .map((row) => row.id);
}

type PartnerT = ReturnType<typeof useTranslations<"Partner">>;

function notifyTrackingSaved(isEdit: boolean, t: PartnerT) {
  useToastStore.getState().push({
    tone: "positive",
    title: isEdit ? t("trackingUpdatedToast") : t("trackingAddedToast"),
    durationMs: 3000,
  });
}

function cardTitleLabels(t: PartnerT) {
  return {
    token: (id: string) => t("tokenFallback", { id }),
    card: t("cardFallback"),
  };
}

function deadlineText(
  deadline: { text: string; days?: number; hours?: number },
  t: PartnerT,
): string {
  if (deadline.hours == null) return deadline.text;
  return deadline.days && deadline.days > 0
    ? t("deadlineDaysLeft", { days: deadline.days, hours: deadline.hours })
    : t("deadlineHoursLeft", { hours: deadline.hours });
}

function statusChipClass(key: string): string {
  if (key === "new") return "partner-ship__st--new";
  if (key === "preparing") return "partner-ship__st--prep";
  if (key === "shipped" || key === "delivered") return "partner-ship__st--ship";
  return "partner-ship__st--other";
}

function CarrierChevron({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function TrackingModal({
  group,
  metadataImages,
  metadataByTokenId,
  onClose,
  onSaved,
}: {
  group: ShipmentGroup;
  metadataImages: ReadonlyMap<string, string>;
  metadataByTokenId: ReadonlyMap<string, RwaMetadata>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Partner");
  const [trackingNumber, setTrackingNumber] = useState(
    group.trackingNumber ?? "",
  );
  const [carrier, setCarrier] = useState(
    group.trackingCarrier?.toLowerCase() || "dhl",
  );
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(group.trackingNumber?.trim());
  const carrierOptions = MODAL_CARRIERS.some((c) => c.value === carrier)
    ? MODAL_CARRIERS
    : [
        { value: carrier, label: formatCarrierLabel(carrier) || carrier },
        ...MODAL_CARRIERS,
      ];

  const mutation = useMutation({
    mutationFn: () =>
      patchPartnerRedeemBatchTracking({
        batchId: group.paymentBatchId,
        shipmentKey: group.shipmentKey,
        redemptionIds: openRedemptionIds(group),
        trackingNumber: trackingNumber.replace(/\s+/g, ""),
        trackingCarrier: carrier,
      }),
    onSuccess: () => {
      notifyTrackingSaved(isEdit, t);
      onSaved();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t("saveTrackingFailed"));
    },
  });

  const deadline = partnerRedeemDeadlineCountdown(
    group.requestedAt,
    group.tab === "to_ship",
  );

  function submit() {
    const num = trackingNumber.replace(/\s+/g, "");
    if (num.length < 6) {
      setError(t("invalidTracking"));
      return;
    }
    mutation.mutate();
  }

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
              {isEdit ? t("editTracking") : t("addTracking")}
            </h2>
          </div>
          <button
            type="button"
            className="partner-ship__iconbtn"
            aria-label={t("close")}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="partner-ship-modal__panel">
          <div className="partner-ship-modal__plain">
            {t("cardsToShip", { count: group.items.length })}
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
                    <span className="partner-ship__cname-t">
                      {partnerRedeemCardTitle(item, metadataByTokenId, cardTitleLabels(t))}
                    </span>
                  </span>
                  {partnerCardCertLine(item, metadataByTokenId) ? (
                    <span className="partner-ship__cid">
                      {partnerCardCertLine(item, metadataByTokenId)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="partner-ship-modal__hint">
            {t("oneTrackingHint")}
          </p>
          <hr className="partner-ship-modal__rule" />
          <div className="partner-ship-modal__eyebrow">{t("colShipTo")}</div>
          <div className="partner-ship-modal__addr">
            {partnerShipToAddressLines(group).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <div className="partner-ship-modal__deadline">
            <span className="partner-ship-modal__plain">{t("colDeadline")}</span>
            <span
              className={`partner-ship__dl${deadline.warn ? " partner-ship__dl--warn" : ""}`}
            >
              {deadlineText(deadline, t)}
            </span>
          </div>
        </div>

        <div className="partner-ship-modal__fields">
          <TkField label={t("carrier")} htmlFor="partner-ship-carrier">
            <TkSelect
              id="partner-ship-carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            >
              {carrierOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </TkSelect>
          </TkField>
          <TkField
            label={t("trackingNumber")}
            htmlFor="partner-ship-tracking"
            error={error || undefined}
          >
            <TkInput
              id="partner-ship-tracking"
              value={trackingNumber}
              placeholder={t("trackingPlaceholder")}
              hasError={Boolean(error)}
              onChange={(e) => {
                setTrackingNumber(e.target.value);
                setError(null);
              }}
            />
          </TkField>
        </div>

        <div className="partner-ship-modal__callout">
          <CalloutIcon />
          <span>
            {isEdit ? t("lockEditNote") : t("lockAddNote")}
          </span>
        </div>

        <div className="partner-ship-modal__actions">
          <TkButton
            type="button"
            variant="primary"
            className="partner-ship-modal__submit"
            disabled={mutation.isPending}
            onClick={submit}
          >
            {mutation.isPending
              ? isEdit
                ? t("saving")
                : t("addingTracking")
              : isEdit
                ? t("saveTracking")
                : t("addTrackingNo")}
          </TkButton>
          <TkButton
            type="button"
            variant="ghost"
            className="partner-ship-modal__cancel"
            onClick={onClose}
          >
            {t("cancel")}
          </TkButton>
        </div>
      </div>
    </div>
  );
}

function CalloutIcon() {
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
      <path d="M12 2 2 20h20L12 2z" />
      <line x1="12" y1="9" x2="12" y2="14" />
      <line x1="12" y1="17" x2="12" y2="17" />
    </svg>
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

function InlineTracking({
  group,
  onSaved,
}: {
  group: ShipmentGroup;
  onSaved: () => void;
}) {
  const t = useTranslations("Partner");
  const [number, setNumber] = useState("");
  const [carrier, setCarrier] = useState("fedex");
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      patchPartnerRedeemBatchTracking({
        batchId: group.paymentBatchId,
        shipmentKey: group.shipmentKey,
        redemptionIds: openRedemptionIds(group),
        trackingNumber: number.replace(/\s+/g, ""),
        trackingCarrier: carrier,
      }),
    onSuccess: () => {
      notifyTrackingSaved(false, t);
      onSaved();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t("saveTrackingFailed"));
    },
  });

  function submit() {
    const num = number.replace(/\s+/g, "");
    if (num.length < 6) {
      setInvalid(true);
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="partner-ship__trk-wrap">
      <div className="partner-ship__trk">
        <span className="partner-ship__trk-car-wrap">
          <select
            className="partner-ship__trk-car"
            aria-label={t("carrier")}
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          >
            {INLINE_CARRIERS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <CarrierChevron className="partner-ship__trk-chev" />
        </span>
        <input
          type="text"
          className={`partner-ship__trk-in${invalid ? " partner-ship__trk-in--err" : ""}`}
          value={number}
          placeholder={t("trackingNumber")}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            setNumber(e.target.value);
            setInvalid(false);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className="partner-ship__trk-add"
          disabled={mutation.isPending}
          onClick={submit}
        >
          {t("add")}
        </button>
      </div>
      {error ? <span className="partner-ship__trk-msg">{error}</span> : null}
    </div>
  );
}

function ShipmentRow({
  group,
  expanded,
  menuOpen,
  metadataImages,
  metadataByTokenId,
  onToggleExpand,
  onToggleMenu,
  onEnterTracking,
  onSaved,
}: {
  group: ShipmentGroup;
  expanded: boolean;
  menuOpen: boolean;
  metadataImages: ReadonlyMap<string, string>;
  metadataByTokenId: ReadonlyMap<string, RwaMetadata>;
  onToggleExpand: () => void;
  onToggleMenu: () => void;
  onEnterTracking: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const first = group.items[0]!;
  const extra = group.items.length - 1;
  const statusKey = partnerShipmentStatusKey(group);
  const statusLabel: Record<PartnerShipmentStatusKey, string> = {
    new: t("statusNew"),
    preparing: t("statusPreparing"),
    shipped: t("tabShipped"),
    delivered: t("tabDelivered"),
    cancelled: t("tabCancelled"),
  };
  const status = { label: statusLabel[statusKey] };
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
              <span className="partner-ship__cname-t">
                {partnerRedeemCardTitle(first, metadataByTokenId, cardTitleLabels(t))}
              </span>
              <span className={`partner-ship__st ${statusChipClass(statusKey)}`}>
                {status.label}
              </span>
            </span>
            {partnerCardCertLine(first, metadataByTokenId) ? (
              <span className="partner-ship__cid">
                {partnerCardCertLine(first, metadataByTokenId)}
              </span>
            ) : null}
            {extra > 0 ? (
              <button
                type="button"
                className="partner-ship__more"
                onClick={onToggleExpand}
              >
                {expanded ? t("hide") : t("moreCount", { count: extra })}
              </button>
            ) : null}
          </span>
        </div>

        <div>
          <span className="partner-ship__cellk">{t("colShipTo")}</span>
          <span className="partner-ship__v">{shipName}</span>
          {shipCity ? <span className="partner-ship__vs">{shipCity}</span> : null}
        </div>

        <div>
          <span className="partner-ship__cellk">{t("colRequested")}</span>
          <span className="partner-ship__v partner-ship__v--mono">
            {formatPartnerRedeemRequestedAt(group.requestedAt, locale)}
          </span>
        </div>

        <div>
          <span className="partner-ship__cellk">{t("colDeadline")}</span>
          <span
            className={`partner-ship__dl${deadline.warn ? " partner-ship__dl--warn" : ""}`}
          >
            {deadlineText(deadline, t)}
          </span>
        </div>

        <div>
          <span className="partner-ship__cellk">{t("colStatus")}</span>
          <span className="partner-ship__status-pill">{status.label}</span>
        </div>

        <div>
          <div className="partner-ship__action">
            {group.tab === "to_ship" ? (
              <>
                <InlineTracking group={group} onSaved={onSaved} />
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
                    <span className="partner-ship__track-carrier">
                      {carrierShown || "—"}
                    </span>
                    {trackingHref ? (
                      <a
                        className="partner-ship__track-num"
                        href={trackingHref}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {group.trackingNumber}
                      </a>
                    ) : (
                      <span className="partner-ship__track-num">
                        {group.trackingNumber}
                      </span>
                    )}
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
              <span className="partner-ship__vs">{t("noAction")}</span>
            )}
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="partner-ship__expand partner-ship__expand--open">
          <div className="partner-ship__kv">
            <b>{t("colShipTo")}</b>
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
                      <span className="partner-ship__cname-t">
                        {partnerRedeemCardTitle(item, metadataByTokenId, cardTitleLabels(t))}
                      </span>
                    </span>
                    {partnerCardCertLine(item, metadataByTokenId) ? (
                      <span className="partner-ship__cid">
                        {partnerCardCertLine(item, metadataByTokenId)}
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
  const t = useTranslations("Partner");
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
        aria-label={t("moreActions")}
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
            {t("viewAddress")}
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
              {t("editTracking")}
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/** Partner-Shipments.html — redeem requests queue + tracking entry. */
export function PartnerShipmentsView() {
  const t = useTranslations("Partner");
  useLocale();
  useCatalogNameRevision();
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

  const cardMeta = usePartnerRedeemMetadata(query.data?.items ?? []);
  const metadataImages = cardMeta.images;
  const metadataByTokenId = cardMeta.metadataByTokenId;

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
  const tabLabel: Record<TabId, string> = {
    to_ship: t("tabToShip"),
    shipped: t("tabShipped"),
    delivered: t("tabDelivered"),
    cancelled: t("tabCancelled"),
    all: t("tabAll"),
  };

  return (
    <div className="partner-redeem-page tkl-wrap">
      <nav className="partner-redeem-page__breadcrumb" aria-label={t("collection")}>
        <Link href={PARTNER_PORTFOLIO_PATH}>{t("collection")}</Link>
        <span className="partner-redeem-page__breadcrumb-sep" aria-hidden>
          /
        </span>
        <span>{t("requests")}</span>
      </nav>

      <div className="partner-redeem-page__head">
        <div className="partner-redeem-page__head-copy">
          <h1 className="partner-redeem-page__title">{t("requests")}</h1>
          <p className="partner-redeem-page__sub">{t("requestsSub")}</p>
        </div>
        <div className="partner-redeem-page__pills" aria-label={t("summary")}>
          <span className="partner-redeem-page__pill partner-redeem-page__pill--neutral">
            {t("toShip", { count: counts.to_ship })}
          </span>
        </div>
      </div>

      {dueSoonCount > 0 ? (
        <div className="partner-redeem-page__banner" role="status">
          <UrgencyIcon />
          <span>
            {t(dueSoonCount === 1 ? "dueSoonOne" : "dueSoon", {
              count: dueSoonCount,
            })}
          </span>
        </div>
      ) : null}

      <div className="partner-ship">
        <div className="partner-ship__tabs" role="tablist" aria-label={t("shipmentStatus")}>
          {TAB_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`partner-ship__tab${tab === id ? " partner-ship__tab--on" : ""}`}
              onClick={() => {
                setTab(id);
                setExpandedKey(null);
                setMenuKey(null);
              }}
            >
              {tabLabel[id]}
              <span className="partner-ship__tab-count">{counts[id]}</span>
            </button>
          ))}
        </div>

        <div className="partner-ship__tbl">
          <div className="partner-ship__thead" aria-hidden={query.isLoading}>
            <span className="partner-ship__th">{t("colCard")}</span>
            <span className="partner-ship__th">{t("colShipTo")}</span>
            <span className="partner-ship__th">{t("colRequested")}</span>
            <span className="partner-ship__th">{t("colDeadline")}</span>
            <span className="partner-ship__th">{t("colStatus")}</span>
            <span className="partner-ship__th partner-ship__th--action">
              {t("colAction")}
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
                  metadataByTokenId={metadataByTokenId}
                  onToggleExpand={() =>
                    setExpandedKey((k) => (k === g.key ? null : g.key))
                  }
                  onToggleMenu={() =>
                    setMenuKey((k) => (k === g.key ? null : g.key))
                  }
                  onEnterTracking={() => setEditing(g)}
                  onSaved={() => {
                    void qc.invalidateQueries({
                      queryKey: rq.partnerRedeems(),
                    });
                  }}
                />
              ))
            )}
          </div>

          {query.isError ? (
            <div className="partner-ship__empty">
              {t("loadFailed")}{" "}
              <button
                type="button"
                className="partner-ship__retry"
                onClick={() => void query.refetch()}
              >
                {t("retry")}
              </button>
            </div>
          ) : showToShipEmpty ? (
            <div className="partner-ship__empty">
              <div className="partner-ship__empty-icon" aria-hidden>
                <EmptyCheckIcon />
              </div>
              <div className="partner-ship__empty-title">
                {t("caughtUp")}
              </div>
            </div>
          ) : !query.isLoading && filtered.length === 0 ? (
            <div className="partner-ship__empty">
              <div className="partner-ship__empty-title">{t("nothingYet")}</div>
            </div>
          ) : null}
        </div>
      </div>

      {editing ? (
        <TrackingModal
          group={editing}
          metadataImages={metadataImages}
          metadataByTokenId={metadataByTokenId}
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
