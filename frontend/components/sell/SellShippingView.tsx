"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

const COUNTRIES: { value: string; label: string }[] = [
  { value: "us", label: "United States" },
  { value: "ca", label: "Canada" },
  { value: "gb", label: "United Kingdom" },
  { value: "de", label: "Germany" },
  { value: "jp", label: "Japan" },
  { value: "kr", label: "South Korea" },
  { value: "intl", label: "Other" },
];

const PACK_NOTES = [
  "Put the packing slip inside the box. PSA uses it to match the card to your Tokenable account.",
  "Sleeve the slab and pack it in a bubble mailer or sturdy box.",
  "Ship with a tracked carrier.",
];

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

function countryLabel(code: string) {
  return COUNTRIES.find((c) => c.value === code)?.label ?? code;
}

function ReturnSummary({ addr }: { addr: SellReturnAddressDraft }) {
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
      {addr.country.trim() ? `, ${countryLabel(addr.country)}` : null}
    </div>
  );
}

export function SellShippingView() {
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
    setTrackingAdded(true);
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
  const trackingReady = ship.trackingNumber.trim().length > 0 && !ship.trackingErr;
  const doneDisabled = !trackingAdded || !ship.canConfirm || ship.confirming;

  return (
    <VaultAuthGate>
      <div className="sell-flow-page">
        <section className="psa-ship">
          <nav className="psa-ship-crumb" aria-label="Breadcrumb">
            <Link href="/vault">Sell</Link>
            <span className="psa-ship-crumb__sep">›</span>
            <button type="button" onClick={ship.backToCards}>
              Submit Card
            </button>
            <span className="psa-ship-crumb__sep">›</span>
            <span className="psa-ship-crumb__here">Shipping</span>
          </nav>

          <h1 className="psa-ship__title">Ship to PSA</h1>
          {ship.submissionPublicId ? (
            <div className="psa-ship__subid">
              Submission <span className="psa-ship-mono">{ship.submissionPublicId}</span>
            </div>
          ) : (
            <div className="psa-ship__subid">Submission</div>
          )}

          <SellFlowProgressSteps
            phase="ship"
            submitDone
            shipSublabel={trackingAdded ? "In transit" : "Pending"}
            canGoSubmit={!ship.confirmed && !ship.isTrackingEdit}
            onSubmit={ship.backToCards}
          />

          {ship.packageSyncError ? (
            <div className="psa-ship-sync" role="alert">
              <div>
                <p className="psa-ship-sync__title">Couldn&rsquo;t save package</p>
                <p className="psa-ship-sync__copy">{ship.packageSyncError}</p>
              </div>
              <TkButton
                type="button"
                variant="primary"
                size="sm"
                disabled={ship.packageSyncing}
                onClick={ship.retryPackageSync}
              >
                {ship.packageSyncing ? "Saving…" : "Retry save"}
              </TkButton>
            </div>
          ) : null}

          <article className="psa-ship-card">
            <h2>
              <span>1</span>Pack and ship
            </h2>
            <div className="psa-ship-addr">
              <div className="psa-ship-addr__k">Ship to</div>
              <div className="psa-ship-addr__v">
                TOKENABLE LIMITED (<span className="psa-ship-mono">107038975</span>)
                <br />
                600 Ships Landing Way
                <br />
                New Castle, DE <span className="psa-ship-mono">19720</span>, United States
              </div>
            </div>
            <ul className="psa-ship-notes">
              {PACK_NOTES.map((note) => (
                <li key={note}>
                  <CheckIcon />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            <div className="psa-ship-actions">
              <button type="button" className="psa-ship-chip" onClick={ship.onDownloadSlip}>
                <DownloadIcon />
                {ship.slipDownloaded ? "Downloaded" : "Download packing slip"}
              </button>
              <button type="button" className="psa-ship-chip" onClick={ship.copyAddress}>
                <CopyIcon />
                {ship.addrCopied ? "Copied" : "Copy address"}
              </button>
            </div>
          </article>

          <article className="psa-ship-card">
            <h2>
              <span>2</span>Return address
            </h2>
            {returnOpen ? (
              <div className="psa-ship-return-form">
                <label className="psa-ship-field">
                  <span>Sender name</span>
                  <input
                    value={ship.returnAddress.name}
                    disabled={ship.confirmed}
                    autoComplete="name"
                    onChange={(e) => ship.setReturnAddressField("name", e.target.value)}
                  />
                </label>
                <label className="psa-ship-field">
                  <span>Address line 1</span>
                  <input
                    value={ship.returnAddress.line1}
                    disabled={ship.confirmed}
                    autoComplete="address-line1"
                    onChange={(e) => ship.setReturnAddressField("line1", e.target.value)}
                  />
                </label>
                <label className="psa-ship-field">
                  <span>Address line 2 (optional)</span>
                  <input
                    value={ship.returnAddress.line2}
                    disabled={ship.confirmed}
                    autoComplete="address-line2"
                    onChange={(e) => ship.setReturnAddressField("line2", e.target.value)}
                  />
                </label>
                <div className="psa-ship-field-row">
                  <label className="psa-ship-field">
                    <span>City</span>
                    <input
                      value={ship.returnAddress.city}
                      disabled={ship.confirmed}
                      autoComplete="address-level2"
                      onChange={(e) => ship.setReturnAddressField("city", e.target.value)}
                    />
                  </label>
                  <label className="psa-ship-field">
                    <span>State / region</span>
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
                    <span>Postal code</span>
                    <input
                      value={ship.returnAddress.postal}
                      disabled={ship.confirmed}
                      autoComplete="postal-code"
                      onChange={(e) => ship.setReturnAddressField("postal", e.target.value)}
                    />
                  </label>
                  <label className="psa-ship-field">
                    <span>Country</span>
                    <select
                      value={ship.returnAddress.country}
                      disabled={ship.confirmed}
                      onChange={(e) => ship.setReturnAddressField("country", e.target.value)}
                    >
                      <option value="">Select a country</option>
                      {COUNTRIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="psa-ship-field">
                  <span>Phone</span>
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
                    Fill in the return address so PSA can send the card back if intake fails.
                  </p>
                ) : null}
                <div className="psa-ship-return-form__actions">
                  {ship.returnComplete ? (
                    <button type="button" className="psa-ship-chip" onClick={() => setReturnOpen(false)}>
                      Cancel
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
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="psa-ship-return">
                <ReturnSummary addr={ship.returnAddress} />
                <button type="button" className="psa-ship-link" disabled={ship.confirmed} onClick={() => setReturnOpen(true)}>
                  Change
                </button>
              </div>
            )}
            <p className="psa-ship-note">PSA sends the card here if it can&rsquo;t be vaulted.</p>
          </article>

          <article className="psa-ship-card">
            <h2>
              <span>3</span>Add tracking
            </h2>
            {trackingAdded ? (
              <div className="psa-ship-track-done">
                <CheckIcon />
                <div>
                  In transit · {carrierLabel}{" "}
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
                  Edit
                </button>
              </div>
            ) : (
              <div>
                <div className="psa-ship-carriers" role="group" aria-label="Carrier">
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
                    placeholder="Tracking number"
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
                    Add
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
            {ship.confirming ? "Saving…" : "Done"}
          </button>
        </section>
      </div>
    </VaultAuthGate>
  );
}
