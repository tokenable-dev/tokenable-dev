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
            <span className="sell-ship-banner__title">Ready to ship — send it directly to PSA</span>
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
            <h1 className="sell-flow-h1">Ship to PSA</h1>
            <p className="sell-flow-sub">
              Send your cards to PSA. Once they arrive and pass intake, they&rsquo;ll be stored at
              PSA Vault and land in your portfolio — set a price there to go live.
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
          ) : null}

          {ship.panel === "pack" ? (
            <div className="sell-ship-panel">
              <div className="sell-ship-panel__eyebrow">Step 2a · Pack &amp; prepare</div>

              <div className="sell-ship-danger-banner" role="note">
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

              <div className="sell-ship-box sell-ship-box--accent">
                <span className="sell-ship-label">Ship To</span>
                <div className="sell-ship-addr-name">{PSA_SHIP_TO.name}</div>
                <div className="sell-ship-addr-row">
                  <div className="sell-ship-addr-lines">
                    {PSA_SHIP_TO.lines.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`sell-ship-copy-icon${ship.addrCopied ? " sell-ship-copy-icon--ok" : ""}`}
                    aria-label="Copy address"
                    title="Copy address"
                    onClick={ship.copyAddress}
                  >
                    {ship.addrCopied ? (
                      <CheckIcon size={15} />
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="sell-ship-divider" />
                <button
                  type="button"
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
                      Download packing slip
                    </>
                  )}
                </button>
                <p className="sell-ship-slip-hint">
                  You can print or download the packing slip any time — before, during, or after packing.
                </p>
              </div>

              <div className="sell-ship-howto">
                <h2 className="sell-ship-howto__title">Shipping instructions</h2>
                <p className="sell-ship-howto__sub">
                  Follow these three steps and label the box clearly with the address above. Keep the
                  packing slip inside the box so PSA can match your cards to your account.
                </p>
                <div className="sell-ship-howto__grid">
                  <article className="sell-ship-howto__card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/assets/sell/Firefly.png"
                      alt="Gloved hands sleeving graded slabs"
                      className="sell-ship-howto__img"
                    />
                    <div className="sell-ship-howto__body">
                      <div className="sell-ship-howto__step">Step 1</div>
                      <div className="sell-ship-howto__name">Prepare your cards</div>
                      <p className="sell-ship-howto__copy">
                        Sleeve each slab on its own. Remove stickers, price tags and team bags before
                        packing.
                      </p>
                    </div>
                  </article>
                  <article className="sell-ship-howto__card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/assets/sell/Firefly_seed123449.png"
                      alt="Card packed in bubble wrap inside a padded box"
                      className="sell-ship-howto__img"
                    />
                    <div className="sell-ship-howto__body">
                      <div className="sell-ship-howto__step">Step 2</div>
                      <div className="sell-ship-howto__name">Pack it</div>
                      <ul className="sell-ship-howto__list">
                        <li>Cardboard on both sides of each card, held with a rubber band</li>
                        <li>Two to three layers of bubble wrap around each card</li>
                        <li>Fill empty space so nothing shifts</li>
                        <li>Packing slip inside the box — required</li>
                      </ul>
                    </div>
                  </article>
                  <article className="sell-ship-howto__card">
                    <div className="sell-ship-howto__img sell-ship-howto__img--contain">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/assets/sell/carriers-ce5c67aa.png" alt="UPS · DHL · FedEx" />
                    </div>
                    <div className="sell-ship-howto__body">
                      <div className="sell-ship-howto__step">Step 3</div>
                      <div className="sell-ship-howto__name">Mail it</div>
                      <p className="sell-ship-howto__copy">
                        Send it with any major carrier to the address above, then register the tracking
                        number here.
                      </p>
                    </div>
                  </article>
                </div>
              </div>

              <TkButton
                type="button"
                variant="primary"
                className="sell-ship-continue"
                disabled={!ship.canContinuePack}
                onClick={ship.goToTrack}
              >
                Register tracking number <ArrowRightIcon />
              </TkButton>
              {!ship.canContinuePack ? (
                <p className="sell-ship-gate-hint">
                  {ship.packageSyncError
                    ? "Save your package (retry above) before continuing."
                    : "Saving your package…"}
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

              <div className="sell-ship-return">
                <span className="sell-ship-label">Return Address</span>
                <div className="sell-ship-box">
                  <p className="sell-ship-return__copy">
                    Where PSA sends the card back if it fails intake. Enter it once — we&rsquo;ll
                    keep it for your next submission.
                  </p>

                  {!ship.returnEditing && ship.returnComplete ? (
                    <div className="sell-ship-return__saved">
                      <span className="sell-ship-return__saved-text">
                        {ship.returnSummary || "Saved return address on file."}
                      </span>
                      <button
                        type="button"
                        className="sell-ship-outline-btn sell-ship-outline-btn--sm"
                        disabled={ship.confirmed}
                        onClick={ship.editReturnAddress}
                      >
                        Use a different one
                      </button>
                    </div>
                  ) : (
                    <div className="sell-ship-return__fields">
                      <TkField
                        label="Sender name"
                        htmlFor="sell-ret-name"
                        error={
                          ship.returnTouched && !ship.returnAddress.name.trim()
                            ? "Required"
                            : undefined
                        }
                      >
                        <TkInput
                          id="sell-ret-name"
                          type="text"
                          placeholder="Full name or company"
                          autoComplete="name"
                          value={ship.returnAddress.name}
                          disabled={ship.confirmed}
                          hasError={
                            ship.returnTouched && !ship.returnAddress.name.trim()
                          }
                          onChange={(e) =>
                            ship.setReturnAddressField("name", e.target.value)
                          }
                        />
                      </TkField>
                      <TkField
                        label="Address line 1"
                        htmlFor="sell-ret-a1"
                        error={
                          ship.returnTouched && !ship.returnAddress.line1.trim()
                            ? "Required"
                            : undefined
                        }
                      >
                        <TkInput
                          id="sell-ret-a1"
                          type="text"
                          placeholder="Street address"
                          autoComplete="address-line1"
                          value={ship.returnAddress.line1}
                          disabled={ship.confirmed}
                          hasError={
                            ship.returnTouched && !ship.returnAddress.line1.trim()
                          }
                          onChange={(e) =>
                            ship.setReturnAddressField("line1", e.target.value)
                          }
                        />
                      </TkField>
                      <TkField label="Address line 2 (optional)" htmlFor="sell-ret-a2">
                        <TkInput
                          id="sell-ret-a2"
                          type="text"
                          placeholder="Suite, unit, floor"
                          autoComplete="address-line2"
                          value={ship.returnAddress.line2}
                          disabled={ship.confirmed}
                          onChange={(e) =>
                            ship.setReturnAddressField("line2", e.target.value)
                          }
                        />
                      </TkField>
                      <div className="sell-ship-track-grid">
                        <TkField
                          label="City"
                          htmlFor="sell-ret-city"
                          error={
                            ship.returnTouched && !ship.returnAddress.city.trim()
                              ? "Required"
                              : undefined
                          }
                        >
                          <TkInput
                            id="sell-ret-city"
                            type="text"
                            placeholder="City"
                            autoComplete="address-level2"
                            value={ship.returnAddress.city}
                            disabled={ship.confirmed}
                            hasError={
                              ship.returnTouched && !ship.returnAddress.city.trim()
                            }
                            onChange={(e) =>
                              ship.setReturnAddressField("city", e.target.value)
                            }
                          />
                        </TkField>
                        <TkField
                          label="State / region"
                          htmlFor="sell-ret-state"
                          error={
                            ship.returnTouched && !ship.returnAddress.region.trim()
                              ? "Required"
                              : undefined
                          }
                        >
                          <TkInput
                            id="sell-ret-state"
                            type="text"
                            placeholder="State or region"
                            autoComplete="address-level1"
                            value={ship.returnAddress.region}
                            disabled={ship.confirmed}
                            hasError={
                              ship.returnTouched &&
                              !ship.returnAddress.region.trim()
                            }
                            onChange={(e) =>
                              ship.setReturnAddressField("region", e.target.value)
                            }
                          />
                        </TkField>
                      </div>
                      <div className="sell-ship-track-grid">
                        <TkField
                          label="Postal code"
                          htmlFor="sell-ret-zip"
                          error={
                            ship.returnTouched && !ship.returnAddress.postal.trim()
                              ? "Required"
                              : undefined
                          }
                        >
                          <TkInput
                            id="sell-ret-zip"
                            type="text"
                            placeholder="Postal code"
                            autoComplete="postal-code"
                            value={ship.returnAddress.postal}
                            disabled={ship.confirmed}
                            hasError={
                              ship.returnTouched &&
                              !ship.returnAddress.postal.trim()
                            }
                            onChange={(e) =>
                              ship.setReturnAddressField("postal", e.target.value)
                            }
                          />
                        </TkField>
                        <TkField
                          label="Country"
                          htmlFor="sell-ret-country"
                          error={
                            ship.returnTouched && !ship.returnAddress.country.trim()
                              ? "Required"
                              : undefined
                          }
                        >
                          <TkSelect
                            id="sell-ret-country"
                            value={ship.returnAddress.country}
                            disabled={ship.confirmed}
                            hasError={
                              ship.returnTouched &&
                              !ship.returnAddress.country.trim()
                            }
                            onChange={(e) =>
                              ship.setReturnAddressField("country", e.target.value)
                            }
                          >
                            <option value="">Select a country</option>
                            <option value="us">United States</option>
                            <option value="ca">Canada</option>
                            <option value="gb">United Kingdom</option>
                            <option value="de">Germany</option>
                            <option value="jp">Japan</option>
                            <option value="kr">South Korea</option>
                            <option value="intl">Other international</option>
                          </TkSelect>
                        </TkField>
                      </div>
                      <TkField
                        label="Phone"
                        htmlFor="sell-ret-phone"
                        error={
                          ship.returnTouched && !ship.returnAddress.phone.trim()
                            ? "Required"
                            : undefined
                        }
                      >
                        <TkInput
                          id="sell-ret-phone"
                          type="tel"
                          inputMode="numeric"
                          placeholder="Reachable during business hours"
                          autoComplete="tel"
                          value={ship.returnAddress.phone}
                          disabled={ship.confirmed}
                          hasError={
                            ship.returnTouched && !ship.returnAddress.phone.trim()
                          }
                          onChange={(e) =>
                            ship.setReturnAddressField("phone", e.target.value)
                          }
                        />
                      </TkField>
                    </div>
                  )}

                  {ship.returnTouched && !ship.returnComplete ? (
                    <p className="sell-ship-gate-hint" role="alert">
                      Fill in the return address so PSA can send the card back if intake fails.
                    </p>
                  ) : null}
                </div>
              </div>

              <span className="sell-ship-label">Register Tracking</span>
              <div className="sell-ship-box sell-ship-track-box">
                <div className="sell-ship-track-head">
                  <span>Tracking details</span>
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
                  Shipping damage or loss is the sender&rsquo;s responsibility.
                  Insurance recommended for cards over $500.
                </span>
              </div>

              <div className="sell-ship-proc">
                Processing takes{" "}
                <strong>14–16 business days after your card arrives at PSA</strong>.
                Customs clearance may add several days and is outside our control.
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
