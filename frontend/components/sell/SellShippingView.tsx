"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TkButton } from "@/components/ds";
import { VaultAuthGate } from "@/components/vault/VaultAuthGate";
import { useSellShipping } from "@/hooks/sell/useSellShipping";
import type { SellCarrier, SellReturnAddressDraft } from "@/lib/sell/sellFlowDraft";
import { SellFlowProgressSteps } from "./SellFlowProgressSteps";

const CARRIERS: { value: SellCarrier; label: string }[] = [
  { value: "fedex", label: "FedEx" },
  { value: "ups", label: "UPS" },
  { value: "dhl", label: "DHL" },
];

const COUNTRY_CODES = ["us", "ca", "gb", "de", "jp", "kr", "intl"] as const;

function countryLabel(code: string, locale: string, other: string) {
  if (!code || code === "intl") return other;
  try {
    return (
      new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ??
      other
    );
  } catch {
    return other;
  }
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A6FFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ReturnSummary({ addr }: { addr: SellReturnAddressDraft }) {
  const t = useTranslations("Sell");
  const locale = useLocale();
  const street = [addr.line1.trim(), addr.line2.trim()].filter(Boolean).join(", ");
  const place = [addr.city.trim(), addr.region.trim()].filter(Boolean).join(", ");
  return (
    <div className="psa-ship-return__text">
      {addr.name.trim()}
      <br />
      {street}
      {street && place ? ", " : null}
      {place}
      {addr.postal.trim() ? (
        <>
          {" "}
          <span className="psa-ship-mono">{addr.postal.trim()}</span>
        </>
      ) : null}
      {addr.country.trim()
        ? `, ${countryLabel(addr.country, locale, t("countryOther"))}`
        : null}
    </div>
  );
}

export function SellShippingView() {
  const t = useTranslations("Sell");
  const locale = useLocale();
  const ship = useSellShipping();
  const [returnOpen, setReturnOpen] = useState(false);
  const [trackingAdded, setTrackingAdded] = useState(false);
  const trackingSeeded = useRef(false);

  useEffect(() => {
    if (ship.ready && !ship.returnComplete) setReturnOpen(true);
  }, [ship.ready, ship.returnComplete]);

  useEffect(() => {
    if (trackingSeeded.current || !ship.ready || !ship.isTrackingEdit) return;
    if (!ship.trackingNumber.trim()) return;
    trackingSeeded.current = true;
    setTrackingAdded(false);
  }, [ship.ready, ship.isTrackingEdit, ship.trackingNumber]);

  if (!ship.ready) {
    return (
      <VaultAuthGate>
        <div className="sell-flow-page">
          <div className="sell-ship-loading" role="status" aria-live="polite">
            <span className="sell-flow-spinner" aria-hidden />
            <span>{ship.bootMessage}</span>
          </div>
        </div>
      </VaultAuthGate>
    );
  }

  const carrierLabel = CARRIERS.find((c) => c.value === ship.carrier)?.label ?? "FedEx";
  const packNotes = [t("pack1"), t("pack2"), t("pack3")];
  const countries = COUNTRY_CODES.map((value) => ({
    value,
    label: countryLabel(value, locale, t("countryOther")),
  }));
  const trackingReady = ship.trackingNumber.trim().length > 0 && !ship.trackingErr;
  const doneDisabled = ship.isTrackingEdit
    ? !trackingReady || !ship.canConfirm || ship.confirming
    : !trackingAdded || !ship.canConfirm || ship.confirming;

  return (
    <VaultAuthGate>
      <div className="sell-flow-page">
        <section className="psa-ship">
          <nav className="psa-ship-crumb" aria-label={t("shipping")}>
            <Link href="/vault">{t("hubTitle")}</Link>
            <span className="psa-ship-crumb__sep">›</span>
            <button type="button" onClick={ship.backToCards}>
              {t("submitCard")}
            </button>
            <span className="psa-ship-crumb__sep">›</span>
            <span className="psa-ship-crumb__here">{t("shipping")}</span>
          </nav>

          <h1 className="psa-ship__title">{t("shipTitle")}</h1>
          {ship.submissionPublicId ? (
            <div className="psa-ship__subid">
              {t("submission")} <span className="psa-ship-mono">{ship.submissionPublicId}</span>
            </div>
          ) : (
            <div className="psa-ship__subid">{t("submission")}</div>
          )}

          <SellFlowProgressSteps
            phase="ship"
            submitDone
            shipSublabel={trackingAdded ? t("inTransit") : t("shipPending")}
            canGoSubmit={!ship.confirmed && !ship.isTrackingEdit}
            onSubmit={ship.backToCards}
          />

          {ship.packageSyncError ? (
            <div className="psa-ship-sync" role="alert">
              <div>
                <p className="psa-ship-sync__title">{t("couldntSave")}</p>
                <p className="psa-ship-sync__copy">{ship.packageSyncError}</p>
              </div>
              <TkButton
                type="button"
                variant="primary"
                size="sm"
                disabled={ship.packageSyncing}
                onClick={ship.retryPackageSync}
              >
                {ship.packageSyncing ? t("saving") : t("retrySave")}
              </TkButton>
            </div>
          ) : null}

          <article className="psa-ship-card">
            <h2>
              <span>1</span>{t("packAndShip")}
            </h2>
            <div className="psa-ship-addr">
              <div className="psa-ship-addr__k">{t("shipTo")}</div>
              <div className="psa-ship-addr__v">
                TOKENABLE LIMITED (<span className="psa-ship-mono">107038975</span>)
                <br />
                600 Ships Landing Way
                <br />
                New Castle, DE <span className="psa-ship-mono">19720</span>, United States
              </div>
            </div>
            <ul className="psa-ship-notes">
              {packNotes.map((note) => (
                <li key={note}>
                  <CheckIcon />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            <div className="psa-ship-actions">
              <button type="button" className="psa-ship-chip" onClick={ship.onDownloadSlip}>
                <DownloadIcon />
                {ship.slipDownloaded ? t("downloaded") : t("downloadSlip")}
              </button>
              <button type="button" className="psa-ship-chip" onClick={ship.copyAddress}>
                <CopyIcon />
                {ship.addrCopied ? t("copied") : t("copyAddress")}
              </button>
            </div>
          </article>

          <article className="psa-ship-card">
            <h2>
              <span>2</span>{t("returnAddress")}
            </h2>
            {returnOpen ? (
              <div className="psa-ship-return-form">
                <label className="psa-ship-field">
                  <span>{t("senderName")}</span>
                  <input
                    value={ship.returnAddress.name}
                    disabled={ship.confirmed}
                    autoComplete="name"
                    onChange={(e) => ship.setReturnAddressField("name", e.target.value)}
                  />
                </label>
                <label className="psa-ship-field">
                  <span>{t("line1")}</span>
                  <input
                    value={ship.returnAddress.line1}
                    disabled={ship.confirmed}
                    autoComplete="address-line1"
                    onChange={(e) => ship.setReturnAddressField("line1", e.target.value)}
                  />
                </label>
                <label className="psa-ship-field">
                  <span>{t("line2")}</span>
                  <input
                    value={ship.returnAddress.line2}
                    disabled={ship.confirmed}
                    autoComplete="address-line2"
                    onChange={(e) => ship.setReturnAddressField("line2", e.target.value)}
                  />
                </label>
                <div className="psa-ship-field-row">
                  <label className="psa-ship-field">
                    <span>{t("city")}</span>
                    <input
                      value={ship.returnAddress.city}
                      disabled={ship.confirmed}
                      autoComplete="address-level2"
                      onChange={(e) => ship.setReturnAddressField("city", e.target.value)}
                    />
                  </label>
                  <label className="psa-ship-field">
                    <span>{t("region")}</span>
                    <input
                      value={ship.returnAddress.region}
                      disabled={ship.confirmed}
                      autoComplete="address-level1"
                      onChange={(e) => ship.setReturnAddressField("region", e.target.value)}
                    />
                  </label>
                </div>
                <div className="psa-ship-field-row">
                  <label className="psa-ship-field">
                    <span>{t("postal")}</span>
                    <input
                      value={ship.returnAddress.postal}
                      disabled={ship.confirmed}
                      autoComplete="postal-code"
                      onChange={(e) => ship.setReturnAddressField("postal", e.target.value)}
                    />
                  </label>
                  <label className="psa-ship-field">
                    <span>{t("country")}</span>
                    <select
                      value={ship.returnAddress.country}
                      disabled={ship.confirmed}
                      onChange={(e) => ship.setReturnAddressField("country", e.target.value)}
                    >
                      <option value="">{t("selectCountry")}</option>
                      {countries.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="psa-ship-field">
                  <span>{t("phone")}</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={ship.returnAddress.phone}
                    disabled={ship.confirmed}
                    autoComplete="tel"
                    onChange={(e) => ship.setReturnAddressField("phone", e.target.value)}
                  />
                </label>
                {ship.returnTouched && !ship.returnComplete ? (
                  <p className="psa-ship-hint" role="alert">
                    {t("fillReturn")}
                  </p>
                ) : null}
                <div className="psa-ship-return-form__actions">
                  {ship.returnComplete ? (
                    <button type="button" className="psa-ship-chip" onClick={() => setReturnOpen(false)}>
                      {t("cancel")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="psa-ship-chip psa-ship-chip--primary"
                    onClick={() => {
                      ship.markReturnTouched();
                      if (ship.returnComplete) setReturnOpen(false);
                    }}
                  >
                    {t("save")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="psa-ship-return">
                <ReturnSummary addr={ship.returnAddress} />
                <button type="button" className="psa-ship-link" disabled={ship.confirmed} onClick={() => setReturnOpen(true)}>
                  {t("change")}
                </button>
              </div>
            )}
            <p className="psa-ship-note">{t("returnNote")}</p>
          </article>

          <article className="psa-ship-card">
            <h2>
              <span>3</span>{ship.isTrackingEdit ? t("editTracking") : t("addTracking")}
            </h2>
            {trackingAdded ? (
              <div className="psa-ship-track-done">
                <CheckIcon />
                <div>
                  {t("inTransit")} · {carrierLabel}{" "}
                  <span className="psa-ship-mono psa-ship-track-done__num">
                    {ship.trackingPreview}
                  </span>
                </div>
                <button
                  type="button"
                  className="psa-ship-link"
                  disabled={ship.confirmed || ship.confirming}
                  onClick={() => setTrackingAdded(false)}
                >
                  {t("edit")}
                </button>
              </div>
            ) : (
              <div>
                <div className="psa-ship-carriers" role="group" aria-label={t("carrier")}>
                  {CARRIERS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      aria-pressed={ship.carrier === c.value}
                      disabled={ship.confirmed}
                      onClick={() => ship.setCarrier(c.value)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="psa-ship-track">
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder={t("trackingNumber")}
                    value={ship.trackingNumber}
                    disabled={ship.confirmed}
                    aria-invalid={Boolean(ship.trackingErr)}
                    onChange={(e) => ship.setTrackingNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && trackingReady) {
                        e.preventDefault();
                        setTrackingAdded(true);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="psa-ship-add"
                    disabled={!trackingReady || ship.confirmed}
                    onClick={() => setTrackingAdded(true)}
                  >
                    {t("add")}
                  </button>
                </div>
                {ship.trackingErr ? (
                  <p className="psa-ship-hint" role="alert">
                    {ship.trackingErr}
                  </p>
                ) : null}
              </div>
            )}
          </article>

          <button
            type="button"
            className="psa-ship-done"
            disabled={doneDisabled}
            onClick={() => {
              if (!ship.beginConfirm()) {
                setReturnOpen(true);
                return;
              }
              void ship.confirmShipment();
            }}
          >
            {ship.confirming ? t("saving") : ship.isTrackingEdit ? t("save") : t("done")}
          </button>
          {ship.isTrackingEdit ? (
            <button
              type="button"
              className="psa-ship-link psa-ship-cancel-edit"
              disabled={ship.confirming}
              onClick={ship.backToCards}
            >
              {t("cancel")}
            </button>
          ) : null}
        </section>
      </div>
    </VaultAuthGate>
  );
}
