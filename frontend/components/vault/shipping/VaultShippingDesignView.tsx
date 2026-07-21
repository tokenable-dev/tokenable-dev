"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VaultBreadcrumb } from "@/components/vault/VaultBreadcrumb";
import { VaultStepper } from "@/components/vault/VaultStepper";
import { useAccessGate } from "@/hooks/auth/useAccessGate";
import {
  MOCK_CARD,
  MOCK_SUBMISSION_ID,
  VAULT_SHIP_ADDRESS,
  VAULT_SHIPPING_CARRIERS_ALLOWED,
  VAULT_SHIPPING_CARRIERS_DENIED,
  VAULT_SHIPPING_CHECKLIST,
} from "@/lib/vault/vaultMockData";
import { cn } from "@/lib/ds/cn";

function WarningIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CtaArrow({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

const ADDRESS_TEXT = VAULT_SHIP_ADDRESS.lines.join("\n");

function todayIsoDate() {
  return new Date().toISOString().split("T")[0]!;
}

const CARRIER_TRACK_URLS: Record<string, string> = {
  fedex: "https://www.fedex.com/fedextrack/?trknbr=",
  dhl: "https://www.dhl.com/en/express/tracking.html?AWB=",
  ems: "https://service.epost.go.kr/trace.RetrieveEmsTrace.postal?ems_gubun=EMS&POST_CODE=",
};

export function VaultShippingDesignView() {
  const router = useRouter();
  const { runAccessGate } = useAccessGate(2, "/vault/submit/shipping");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [slipDownloaded, setSlipDownloaded] = useState(false);
  const [slipDownloading, setSlipDownloading] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("fedex");
  const [trackingRegistered, setTrackingRegistered] = useState(false);
  const [shipped, setShipped] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const doneCount = checked.size;
  const allChecked = doneCount === VAULT_SHIPPING_CHECKLIST.length;
  const canRegister =
    allChecked && slipDownloaded && trackingNumber.trim().length >= 5 && !trackingRegistered;
  const canShip = allChecked && slipDownloaded && trackingRegistered && !shipped;

  const progressPct = useMemo(() => (doneCount / VAULT_SHIPPING_CHECKLIST.length) * 100, [doneCount]);

  const carrierLabel = carrier === "dhl" ? "DHL" : carrier === "ems" ? "Korea Post EMS" : "FedEx";
  const trackingDisplay = trackingNumber.trim() || "FX123456789";
  const trackPackageUrl =
    (CARRIER_TRACK_URLS[carrier] ?? CARRIER_TRACK_URLS.fedex!) +
    encodeURIComponent(trackingDisplay.replace(/\s/g, ""));

  const shipSteps = useMemo(
    () =>
      trackingRegistered
        ? [
            { label: "Submit", state: "done" as const },
            {
              label: "Ship",
              state: "active" as const,
              sub: "IN TRANSIT",
              subColor: "azure" as const,
              spin: true,
            },
            { label: "Vault", state: "inactive" as const },
            { label: "Mint", state: "inactive" as const },
          ]
        : [
            { label: "Submit", state: "done" as const },
            {
              label: "Ship",
              state: "active" as const,
              sub: "PENDING",
              subColor: "azure" as const,
            },
            { label: "Vault", state: "inactive" as const },
            { label: "Mint", state: "inactive" as const },
          ],
    [trackingRegistered],
  );

  const toggleCheck = useCallback((index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ADDRESS_TEXT);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  const handleDownloadSlip = useCallback(() => {
    if (!allChecked || slipDownloaded) return;
    setSlipDownloading(true);
    window.setTimeout(() => {
      setSlipDownloading(false);
      setSlipDownloaded(true);
    }, 800);
  }, [allChecked, slipDownloaded]);

  const handleRegisterTracking = useCallback(() => {
    if (!canRegister) return;
    setTrackingRegistered(true);
  }, [canRegister]);

  const handleShipped = useCallback(() => {
    if (!canShip) return;
    runAccessGate(() => {
      setShipped(true);
      window.setTimeout(() => {
        router.push(`/vault/submissions/${MOCK_SUBMISSION_ID}`);
      }, 1200);
    });
  }, [canShip, runAccessGate, router]);

  return (
    <div className="vault-shipping">
      <div className="vault-shipping-status-banner">
        <div className="vault-shipping-status-banner__inner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="vault-shipping-status-banner__title">Card Verified — Ready to Ship</span>
          <span className="vault-shipping-status-banner__dot" />
          <span className="vault-shipping-status-banner__badge">{MOCK_SUBMISSION_ID}</span>
          <span className="vault-shipping-status-banner__dot" />
          <span className="vault-shipping-status-banner__meta">Charizard · {MOCK_CARD.grade}</span>
        </div>
      </div>

      <div className="vault-shipping__body">
        <VaultBreadcrumb
          variant="flow"
          items={[
            { label: "My Vault", href: "/vault" },
            { label: "Submit Card", href: "/vault/submit" },
            { label: "Shipping" },
          ]}
        />

        <div className="vault-shipping-header">
          <span className="vault-shipping-header__eyebrow">Step 2 of 4</span>
          <h1 className="vault-shipping-header__title">Ship Your Card</h1>
          <p className="vault-shipping-header__sub">
            Package your card safely and send it to our vault facility.
          </p>
        </div>

        <VaultStepper steps={shipSteps} />

        <div className="vault-ship-grid">
        <div className="vault-ship-col">
          <div className="vault-ship-block">
            <span className="vault-form-label">Ship To</span>
            <div className="vault-card-box vault-card-box--azure">
              <div className="vault-ship-addr__name">{VAULT_SHIP_ADDRESS.name}</div>
              <div className="vault-ship-addr__lines">
                {VAULT_SHIP_ADDRESS.lines.map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
              </div>
              <div className="vault-ship-addr__id">{MOCK_SUBMISSION_ID}</div>
              <div className="vault-ship-addr__warn">
                <WarningIcon />
                <span>
                  Include your Submission ID on the outside of the package. Do not redirect to any other address.
                </span>
              </div>
              <div className="vault-ship-addr__actions">
                <button
                  type="button"
                  className={cn("vault-ship-outline-btn", copyState === "copied" && "vault-ship-outline-btn--copied")}
                  onClick={handleCopyAddress}
                >
                  {copyState === "copied" ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy Address
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="vault-ship-warn-banner">
            <WarningIcon size={20} />
            <span>
              Damage, loss, or misdelivery during shipping is the sender&apos;s responsibility. We strongly recommend
              using a trackable carrier and purchasing shipping insurance.
            </span>
          </div>

          <div className="vault-ship-block">
            <span className="vault-form-label">Recommended Carriers</span>
            <p className="vault-ship-kyc">
              Auto-detected from KYC: <span className="vault-ship-kyc__flag">🇰🇷</span> South Korea
            </p>
            <div className="vault-card-box">
              {VAULT_SHIPPING_CARRIERS_ALLOWED.map((carrier) => (
                <div key={carrier.name} className="vault-ship-carrier-row">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <div className="vault-ship-carrier-row__body">
                    <div className="vault-ship-carrier-row__name">
                      {carrier.name}
                      {"recommended" in carrier && carrier.recommended ? (
                        <span className="vault-ship-carrier-row__tag">recommended</span>
                      ) : null}
                    </div>
                    <div className="vault-ship-carrier-row__detail">{carrier.detail}</div>
                  </div>
                </div>
              ))}
              {VAULT_SHIPPING_CARRIERS_DENIED.map((carrier) => (
                <div key={carrier.name} className="vault-ship-carrier-row">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--neg)" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <div className="vault-ship-carrier-row__body">
                    <div className="vault-ship-carrier-row__name vault-ship-carrier-row__name--muted">{carrier.name}</div>
                    <div className="vault-ship-carrier-row__detail vault-ship-carrier-row__detail--neg">{carrier.detail}</div>
                  </div>
                </div>
              ))}
              <div className="vault-ship-carrier-tip">
                <WarningIcon />
                <span>Shipping insurance recommended for cards valued over $500.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="vault-ship-col vault-ship-col--sticky">
          <div className="vault-ship-block vault-ship-block--tight">
            <span className="vault-form-label">1 · Before You Ship</span>
            <p className="vault-ship-checklist-intro">
              Complete all items, then download your slip and register tracking
            </p>
            <div className="vault-card-box">
              {VAULT_SHIPPING_CHECKLIST.map((text, index) => {
                const isChecked = checked.has(index);
                return (
                  <div
                    key={text}
                    className={cn("vault-ship-check-item", isChecked && "checked")}
                    onClick={() => toggleCheck(index)}
                    onKeyDown={(e) => e.key === "Enter" && toggleCheck(index)}
                    role="checkbox"
                    aria-checked={isChecked}
                    tabIndex={0}
                  >
                    <div className="vault-ship-check-box">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="3"
                        style={{ opacity: isChecked ? 1 : 0 }}
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div className="vault-ship-check-text">{text}</div>
                  </div>
                );
              })}

              <div className="vault-ship-progress">
                <div className="vault-ship-progress__bar">
                  <div className="vault-ship-progress__fill" style={{ width: `${progressPct}%` }} />
                </div>
                <span
                  className={cn("vault-ship-progress__text", allChecked && "vault-ship-progress__text--done")}
                >
                  {doneCount} / {VAULT_SHIPPING_CHECKLIST.length} completed
                </span>
              </div>

            </div>
          </div>

          <div className="vault-ship-block vault-ship-block--tight">
            <span className="vault-form-label">2 · Packing Slip</span>
            <div
              className={cn("vault-card-box vault-ship-gate", allChecked && "vault-ship-gate--unlocked")}
            >
              <div className="vault-ship-slip__head">
                <span className="vault-ship-slip__title">Download your Packing Slip</span>
                {!allChecked ? (
                  <span className="vault-ship-gate__lock">Complete checklist to unlock</span>
                ) : null}
              </div>
              <p className="vault-ship-slip__desc">
                Must be included inside the box — PSA uses this to identify your submission.
              </p>
              <button
                type="button"
                className={cn(
                  "vault-ship-slip-btn",
                  slipDownloaded && "vault-ship-slip-btn--done",
                )}
                onClick={handleDownloadSlip}
                disabled={!allChecked || slipDownloaded}
              >
                {slipDownloading ? (
                  "Downloading…"
                ) : slipDownloaded ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Downloaded
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download Packing Slip PDF
                  </>
                )}
              </button>
              <div className="vault-ship-slip__warn">Don&apos;t forget this!</div>
            </div>
          </div>

          <div className="vault-ship-block">
            <span className="vault-form-label">3 · Register Tracking Number</span>
            <div
              className={cn(
                "vault-card-box vault-ship-gate",
                slipDownloaded && "vault-ship-gate--unlocked",
              )}
            >
              <div className="vault-ship-tracking__head">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M22 10H18a2 2 0 000 4h4" />
                </svg>
                <span className="vault-ship-tracking__title">Tracking Details</span>
                {!slipDownloaded ? (
                  <span className="vault-ship-gate__lock">Download Packing Slip to unlock</span>
                ) : null}
              </div>
              <div className="vault-ship-tracking__grid">
                <div>
                  <label className="vault-ship-field-label" htmlFor="vault-carrier-select">
                    Carrier
                  </label>
                  <select
                    id="vault-carrier-select"
                    className="vault-ship-select"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    disabled={!slipDownloaded || trackingRegistered}
                  >
                    <option value="fedex">FedEx</option>
                    <option value="dhl">DHL</option>
                    <option value="ems">Korea Post EMS</option>
                  </select>
                </div>
                <div>
                  <label className="vault-ship-field-label" htmlFor="vault-ship-date">
                    Shipping Date
                  </label>
                  <input
                    id="vault-ship-date"
                    type="date"
                    className="vault-ship-input vault-ship-input--date"
                    defaultValue={todayIsoDate()}
                    lang="en"
                    disabled={!slipDownloaded || trackingRegistered}
                  />
                </div>
              </div>
              <div className="vault-ship-tracking__field">
                <label className="vault-ship-field-label" htmlFor="vault-tracking-input">
                  Tracking Number
                </label>
                <input
                  id="vault-tracking-input"
                  type="text"
                  className="vault-ship-input"
                  placeholder="e.g. 7489 2345 6789"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  disabled={!slipDownloaded || trackingRegistered}
                />
              </div>
              <button
                type="button"
                className={cn(
                  "vault-ship-register-btn tk-btn tk-btn--primary tk-btn--sm",
                  trackingRegistered && "vault-ship-register-btn--done",
                  !canRegister && !trackingRegistered && "vault-ship-register-btn--disabled",
                )}
                onClick={handleRegisterTracking}
                disabled={!canRegister && !trackingRegistered}
              >
                {trackingRegistered ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Tracking Registered
                  </>
                ) : (
                  <>
                    Register Tracking <CtaArrow />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="vault-ship-cta">
            {trackingRegistered ? (
              <div className="vault-ship-success">
                <div className="vault-ship-success__head">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Tracking registered successfully</span>
                </div>
                <p className="vault-ship-success__body">
                  Your submission is now <strong>In Transit</strong>. We&apos;ll email you when your card arrives at our
                  Vault.
                </p>
                <div className="vault-ship-success__tracking">
                  <span className="mono vault-ship-success__summary">
                    📦 {carrierLabel} · {trackingDisplay}
                  </span>
                  <a
                    href={trackPackageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vault-ship-outline-btn vault-ship-outline-btn--azure"
                  >
                    Track Package →
                  </a>
                </div>
                <div className="vault-ship-success__status">
                  <Link
                    href={`/vault/submissions/${MOCK_SUBMISSION_ID}`}
                    className="vault-ship-outline-btn vault-ship-outline-btn--azure"
                  >
                    View Submission Status →
                  </Link>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className={cn(
                "vault-ship-primary-btn tk-btn tk-btn--primary",
                !canShip && !shipped && "vault-ship-primary-btn--disabled",
                shipped && "vault-ship-primary-btn--shipped",
              )}
              onClick={handleShipped}
              disabled={!canShip && !shipped}
            >
              {shipped ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Shipped!
                </>
              ) : (
                <>
                  I&apos;ve Shipped My Card <CtaArrow size={16} />
                </>
              )}
            </button>

            <Link href="/vault/submit" className="vault-ship-back-btn tk-btn tk-btn--md">
              Back to Card Details
            </Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
