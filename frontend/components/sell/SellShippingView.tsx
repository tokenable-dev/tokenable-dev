"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TkButton, TkField, TkInput, TkSelect } from "@/components/ds";
import { VaultAuthGate } from "@/components/vault/VaultAuthGate";
import { useSellShipping } from "@/hooks/sell/useSellShipping";
import { PSA_SHIP_TO, type SellCarrier } from "@/lib/sell/sellFlowDraft";
import { SellFlowProgressSteps } from "./SellFlowProgressSteps";

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function BackChevron() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function SellShippingView() {
  const ship = useSellShipping();
  const router = useRouter();

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

  return (
    <VaultAuthGate>
      <div className="sell-flow-page">
        <div className="sell-ship-banner">
          <div className="sell-ship-banner__inner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="sell-ship-banner__title">Ready to ship — send it to tokenable</span>
            <span className="sell-ship-banner__dot" aria-hidden />
            <span className="sell-ship-banner__card">{ship.bannerLabel}</span>
          </div>
        </div>

        <section className="sell-ship-section">
          <nav className="sell-ship-crumb" aria-label="Breadcrumb">
            <Link href="/vault">Sell</Link>
            <span className="sell-ship-crumb__sep">›</span>
            <Link href="/sell/flow">Submit Card</Link>
            <span className="sell-ship-crumb__sep">›</span>
            <span className="sell-ship-crumb__here">Shipping</span>
          </nav>

          <div className="sell-ship-header">
            <div className="sell-flow-eyebrow">Step 2 of 2</div>
            <h1 className="sell-flow-h1">Ship to tokenable</h1>
            <p className="sell-flow-sub">
              Send your cards to tokenable. Once verified, they land in your portfolio — set a price
              there to go live.
            </p>
          </div>

          <SellFlowProgressSteps
            phase="ship"
            submitDone
            shipInTransit={ship.confirmed}
            shipSublabel={ship.shipSublabel}
            canGoSubmit={!ship.confirmed}
            canGoShip={!ship.confirmed && ship.panel === "track"}
            canGoLive={ship.confirmed}
            onSubmit={ship.backToCards}
            onShip={ship.goToPack}
            onLive={() => router.push("/portfolio")}
          />

          {ship.packageSyncError ? (
            <div className="sell-ship-package-sync sell-ship-package-sync--err" role="alert">
              <div className="sell-ship-package-sync__body">
                <p className="sell-ship-package-sync__title">Couldn&rsquo;t save package</p>
                <p className="sell-ship-package-sync__copy">{ship.packageSyncError}</p>
              </div>
              <TkButton
                type="button"
                variant="primary"
                size="sm"
                className="sell-ship-package-sync__retry"
                disabled={ship.packageSyncing}
                onClick={ship.retryPackageSync}
              >
                {ship.packageSyncing ? "Saving…" : "Retry save"}
              </TkButton>
            </div>
          ) : ship.packageReady && !ship.confirmed ? (
            <p className="sell-ship-package-sync sell-ship-package-sync--ok" role="status">
              Package saved to your account ({ship.cards.length} card
              {ship.cards.length === 1 ? "" : "s"}). You can leave and finish tracking later from
              Vault.
            </p>
          ) : ship.packageSyncing ? (
            <p className="sell-ship-package-sync sell-ship-package-sync--pending" role="status">
              Saving package…
            </p>
          ) : null}

          {ship.panel === "pack" ? (
            <div className="sell-ship-panel">
              <div className="sell-ship-track-top">
                <TkButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="sell-ship-outline-btn sell-ship-outline-btn--sm"
                  onClick={ship.backToCards}
                  disabled={ship.confirmed}
                >
                  <BackChevron />
                  Back to cards
                </TkButton>
                <span className="sell-ship-panel__eyebrow sell-ship-panel__eyebrow--inline">
                  Step 2a · Pack &amp; prepare
                </span>
              </div>

              <div className="sell-ship-info">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--azure)" strokeWidth="2" aria-hidden>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Your cards are stored securely in the tokenable vault.</span>
              </div>

              <div className="sell-ship-box sell-ship-box--accent">
                <span className="sell-ship-label">Ship To</span>
                <div className="sell-ship-addr-name">{PSA_SHIP_TO.name}</div>
                <div className="sell-ship-addr-lines">
                  {PSA_SHIP_TO.lines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
                <div className="sell-ship-addr-actions">
                  <TkButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`sell-ship-outline-btn${ship.addrCopied ? " sell-ship-outline-btn--ok" : ""}`}
                    onClick={ship.copyAddress}
                  >
                    {ship.addrCopied ? (
                      <>
                        <CheckIcon /> Copied!
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy address
                      </>
                    )}
                  </TkButton>
                </div>
                <div className="sell-ship-divider" />
                <div className="sell-ship-danger">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>
                    The Packing Slip must be inside the box. PSA cannot match your card to your Tokenable
                    account without it.
                  </span>
                </div>
                <TkButton
                  type="button"
                  variant="ghost"
                  className={`sell-ship-slip-btn${ship.slipDownloaded ? " sell-ship-slip-btn--done" : ""}`}
                  onClick={ship.onDownloadSlip}
                >
                  {ship.slipDownloaded ? (
                    <>
                      <CheckIcon /> Downloaded
                    </>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download Packing Slip
                    </>
                  )}
                </TkButton>
              </div>

              <div className="sell-ship-box">
                <div className="sell-ship-checklist-head">
                  <span>Cards in this shipment</span>
                  <button
                    type="button"
                    className="sell-ship-edit-cards"
                    onClick={ship.backToCards}
                    disabled={ship.confirmed}
                  >
                    Add or remove
                  </button>
                </div>
                <ul className="sell-ship-package-list">
                  {ship.cards.map((card, i) => (
                    <li key={`${card.cert}-${i}`} className="sell-ship-package-row">
                      {card.img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.img} alt="" className="sell-ship-package-row__thumb" />
                      ) : (
                        <div className="sell-ship-package-row__thumb sell-ship-package-row__thumb--empty" />
                      )}
                      <div className="sell-ship-package-row__body">
                        <div className="sell-ship-package-row__name">{card.name}</div>
                        <div className="sell-ship-package-row__meta tkl-mono">
                          PSA {card.grade} · Cert #{card.cert}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="sell-ship-package-row__del"
                        aria-label={`Remove ${card.name}`}
                        title="Remove card"
                        disabled={ship.confirmed}
                        onClick={() => ship.removeCard(i)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="sell-ship-box">
                <div className="sell-ship-checklist-head">
                  <span>How to pack your card</span>
                  <span
                    className={`sell-ship-progress-text${ship.allChecked ? " sell-ship-progress-text--done" : ""}`}
                  >
                    {ship.checkedCount} / {ship.checklistItems.length}
                  </span>
                </div>
                <ul className="sell-ship-checklist">
                  {ship.checklistItems.map((text, i) => {
                    const on = ship.checked[i];
                    const required = i === ship.checklistItems.length - 1;
                    return (
                      <li key={text}>
                        <button
                          type="button"
                          className={`sell-ship-check${on ? " sell-ship-check--on" : ""}`}
                          onClick={() => ship.toggleCheck(i)}
                        >
                          <span className="sell-ship-check__box" aria-hidden>
                            <CheckIcon />
                          </span>
                          <span className={`sell-ship-check__text${required ? " sell-ship-check__text--req" : ""}`}>
                            {text}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <TkButton
                type="button"
                variant="primary"
                className="sell-ship-continue"
                disabled={!ship.canContinuePack}
                onClick={ship.goToTrack}
              >
                Continue to tracking <ArrowRightIcon />
              </TkButton>
              {!ship.canContinuePack ? (
                <p className="sell-ship-gate-hint">
                  {ship.packageSyncError
                    ? "Save your package (retry above) before continuing."
                    : ship.packageSyncing
                      ? "Saving your package…"
                      : "Download the Packing Slip and finish the checklist to continue."}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="sell-ship-panel">
              <div className="sell-ship-track-top">
                <TkButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="sell-ship-outline-btn sell-ship-outline-btn--sm"
                  onClick={ship.goToPack}
                  disabled={ship.confirmed}
                >
                  <BackChevron />
                  Back
                </TkButton>
                <span className="sell-ship-panel__eyebrow sell-ship-panel__eyebrow--inline">
                  Step 2b · Register tracking
                </span>
              </div>

              <span className="sell-ship-label">Register Tracking</span>
              <div
                className={`sell-ship-box sell-ship-track-box${ship.slipDownloaded ? "" : " sell-ship-track-box--locked"}`}
              >
                <div className="sell-ship-track-head">
                  <span>Tracking details</span>
                  {!ship.slipDownloaded ? (
                    <span className="sell-ship-track-lock">Download Packing Slip to unlock</span>
                  ) : null}
                </div>

                <div className="sell-ship-track-grid">
                  <TkField label="Carrier" htmlFor="sell-ship-carrier">
                    <TkSelect
                      id="sell-ship-carrier"
                      value={ship.carrier}
                      disabled={ship.confirmed}
                      onChange={(e) => ship.setCarrier(e.target.value as SellCarrier)}
                    >
                      <option value="fedex">FedEx International Priority — recommended</option>
                      <option value="dhl">DHL Express — recommended</option>
                      <option value="ups">UPS Worldwide</option>
                    </TkSelect>
                  </TkField>
                  <TkField label="Shipping date" htmlFor="sell-ship-date">
                    <TkInput
                      id="sell-ship-date"
                      type="date"
                      value={ship.shipDate}
                      disabled={ship.confirmed}
                      onChange={(e) => ship.setShipDate(e.target.value)}
                    />
                  </TkField>
                </div>

                <p className="sell-ship-track-note">
                  Untracked mail isn&rsquo;t supported — we confirm delivery through carrier tracking.
                </p>

                <TkField
                  className="sell-ship-track-num"
                  label="Tracking number"
                  htmlFor="sell-ship-tracking"
                  error={ship.trackingErr || undefined}
                >
                  <TkInput
                    id="sell-ship-tracking"
                    type="text"
                    placeholder="e.g. 7489 2345 6789"
                    value={ship.trackingNumber}
                    disabled={ship.confirmed}
                    hasError={Boolean(ship.trackingErr)}
                    onChange={(e) => ship.setTrackingNumber(e.target.value)}
                  />
                </TkField>

                <TkButton
                  type="button"
                  variant="primary"
                  className={`sell-ship-confirm${ship.confirmed ? " sell-ship-confirm--done" : ""}`}
                  disabled={!ship.canConfirm}
                  onClick={ship.confirmShipment}
                >
                  {ship.confirmed ? (
                    <>
                      <CheckIcon size={16} /> Shipment confirmed
                    </>
                  ) : ship.confirming ? (
                    <>
                      <span className="sell-flow-spinner" aria-hidden /> Confirming…
                    </>
                  ) : (
                    <>
                      Confirm shipment <ArrowRightIcon />
                    </>
                  )}
                </TkButton>
                {!ship.packageReady && !ship.confirmed ? (
                  <p className="sell-ship-gate-hint">
                    Save your package before confirming tracking.
                  </p>
                ) : null}
              </div>

              <div className="sell-ship-warn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>
                  Shipping damage or loss is the sender&rsquo;s responsibility. Insurance recommended for
                  cards over $500.
                </span>
              </div>

              <div className="sell-ship-proc">
                Processing takes{" "}
                <strong>14–16 business days after your card arrives at PSA</strong>. Customs clearance
                may add several days and is outside our control.
              </div>

              {ship.confirmed ? (
                <div className="sell-ship-success">
                  <div className="sell-ship-success__title">
                    <CheckIcon size={20} />
                    <span>Tracking registered successfully</span>
                  </div>
                  <p className="sell-ship-success__copy">
                    Your card is now <strong>In Transit to PSA</strong>. We&rsquo;ll notify you when PSA
                    confirms your card.
                  </p>
                  <div className="sell-ship-success__row">
                    <span className="sell-ship-success__summary">{ship.trackingSummary}</span>
                    {ship.trackUrl ? (
                      <a
                        href={ship.trackUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="sell-ship-outline-btn sell-ship-outline-btn--link"
                      >
                        Track Package →
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <TkButton
                type="button"
                variant="subtle"
                className="sell-ship-back-cards"
                onClick={ship.backToCards}
                disabled={ship.confirmed}
              >
                Back to Card Details
              </TkButton>
            </div>
          )}
        </section>
      </div>
    </VaultAuthGate>
  );
}
