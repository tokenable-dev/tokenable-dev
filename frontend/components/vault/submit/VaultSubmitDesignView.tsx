"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { TkButton } from "@/components/ds";
import { ASSETS } from "@/constants/assets";
import { VaultBreadcrumb } from "@/components/vault/VaultBreadcrumb";
import { VaultStepper } from "@/components/vault/VaultStepper";
import { useAccessGate } from "@/hooks/auth/useAccessGate";
import { VAULT_SUBMIT_FAQ_ITEMS } from "@/lib/vault/vaultMockData";
import { cn } from "@/lib/ds/cn";

const MAX_CARDS = 99;

type LookupCard = {
  cert: string;
  name: string;
  grade: string;
  rejected: boolean;
  confirmed: boolean;
  value: number;
  imageUrl: string;
};

function CtaArrow({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="2.5" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function resolveLookupCard(cert: string): LookupCard {
  const rejected = cert.startsWith("999");
  return {
    cert,
    name: rejected
      ? "1952 TOPPS #311 MICKEY MANTLE ROOKIE"
      : cert.startsWith("229")
        ? "2023 POKEMON PROMO SVP #085 PIKACHU WITH GREY FELT HAT VAN GOGH"
        : "1999 POKEMON BASE SET 1ST EDITION #4 CHARIZARD HOLO",
    grade: rejected ? "PSA 8" : cert.startsWith("229") ? "PSA 9" : "PSA 10",
    rejected,
    confirmed: false,
    value: rejected ? 0 : cert.startsWith("229") ? 1900 : 25376,
    imageUrl: rejected
      ? ASSETS.ds.cards.charizard
      : cert.startsWith("229")
        ? ASSETS.ds.cards.pikachu
        : ASSETS.ds.cards.charizard,
  };
}

function formatEstValue(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("en-US");
}

function formatRefUsd(total: number): string {
  return `$${total.toLocaleString("en-US")}`;
}

export function VaultSubmitDesignView() {
  const router = useRouter();
  const { runAccessGate } = useAccessGate(2, "/vault/submit");
  const defaultFaqIndex = VAULT_SUBMIT_FAQ_ITEMS.findIndex(
    (item) => "defaultOpen" in item && item.defaultOpen,
  );
  const [faqOpen, setFaqOpen] = useState<number | null>(
    defaultFaqIndex >= 0 ? defaultFaqIndex : null,
  );

  const [certInput, setCertInput] = useState("");
  const [certError, setCertError] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupCards, setLookupCards] = useState<LookupCard[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanCapturing, setScanCapturing] = useState(false);

  const [estValue, setEstValue] = useState("");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [tgState, setTgState] = useState<"idle" | "editing" | "saved">("idle");
  const [tgInput, setTgInput] = useState("");
  const [tgHandle, setTgHandle] = useState<string | null>(null);

  const validCards = lookupCards.filter((c) => !c.rejected);
  const hasRejected = lookupCards.some((c) => c.rejected);
  const allConfirmed = validCards.length > 0 && validCards.every((c) => c.confirmed);
  const estValueNum = parseFloat(estValue.replace(/[^0-9.]/g, ""));
  const canSubmit =
    !submitting &&
    !submitted &&
    validCards.length >= 1 &&
    allConfirmed &&
    !hasRejected &&
    estValueNum > 0 &&
    tosAccepted;

  const estValueRef = useMemo(() => {
    const total = validCards.reduce((sum, c) => sum + c.value, 0);
    if (validCards.length > 0) {
      return `Used for insurance and PSA records. Reference: combined market value ~${formatRefUsd(total)}`;
    }
    return "Used for insurance and PSA records.";
  }, [validCards]);

  const pushCard = useCallback((cert: string) => {
    if (lookupCards.length >= MAX_CARDS) return;
    setLookupCards((prev) => [...prev, resolveLookupCard(cert)]);
    setCertInput("");
  }, [lookupCards.length]);

  const handleLookup = useCallback(() => {
    const val = certInput.trim();
    if (val.length < 6) {
      setCertError(true);
      return;
    }
    setCertError(false);
    setLookupLoading(true);
    window.setTimeout(() => {
      pushCard(val);
      setLookupLoading(false);
    }, 1200);
  }, [certInput, pushCard]);

  const handleScanCapture = useCallback(() => {
    if (lookupCards.length >= MAX_CARDS || scanCapturing) return;
    setScanCapturing(true);
    window.setTimeout(() => {
      const mockCerts = ["12345678", "22938102", "55501248"];
      pushCard(mockCerts[lookupCards.length % mockCerts.length]!);
      setScanCapturing(false);
      setScanOpen(false);
    }, 1500);
  }, [lookupCards.length, pushCard, scanCapturing]);

  const toggleConfirm = useCallback((index: number) => {
    setLookupCards((prev) =>
      prev.map((c, i) => (i === index && !c.rejected ? { ...c, confirmed: !c.confirmed } : c)),
    );
  }, []);

  const confirmAll = useCallback(() => {
    setLookupCards((prev) => prev.map((c) => (c.rejected ? c : { ...c, confirmed: true })));
  }, []);

  const handleRemoveCard = useCallback((index: number) => {
    setLookupCards((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    runAccessGate(() => {
      setSubmitting(true);
      window.setTimeout(() => {
        setSubmitting(false);
        setSubmitted(true);
        window.setTimeout(() => router.push("/vault/submit/shipping"), 1200);
      }, 1500);
    });
  }, [canSubmit, runAccessGate, router]);

  const handleSaveTelegram = useCallback(() => {
    const val = tgInput.trim().replace(/^@/, "");
    if (!val) return;
    setTgHandle(val);
    setTgState("saved");
    setTgInput("");
  }, [tgInput]);

  const submitLabel = useMemo(() => {
    if (submitted) return "✓ Submitted!";
    if (submitting) return "Submitting…";
    return "Continue to Shipping";
  }, [submitted, submitting]);

  const hasValidForConfirm = validCards.length > 0;

  return (
    <>
      <VaultBreadcrumb items={[{ label: "My Vault", href: "/vault" }, { label: "Submit Card" }]} />

      <h1 className="vault-submit-title">Submit a Card</h1>

      <div className="vault-submit-layout">
        <div className="vault-submit-main">
          <VaultStepper active={1} />

          <div className="vault-add-cards-section">
            <label className="vault-form-label">Add Cards</label>
            <div className="vault-add-methods">
              <button type="button" className="vault-add-method" onClick={() => setScanOpen(true)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--azure)" strokeWidth="2" aria-hidden>
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <div className="vault-add-method__title">Scan Card</div>
                <div className="vault-add-method__desc">
                  Tap to open camera — take a photo of the cert number on your PSA slab
                </div>
              </button>

              <div className="vault-add-method vault-add-method--cert">
                <img src={ASSETS.icons.psaMarkSubmit} alt="PSA" className="vault-add-method__psa" />
                <div className="vault-add-method__title">Enter Cert Number</div>
                <div className="vault-add-method__cert-form">
                  <input
                    className={cn("vault-form-input", certError && "vault-form-input--error")}
                    type="text"
                    placeholder="e.g. 12345678"
                    maxLength={10}
                    value={certInput}
                    onChange={(e) => {
                      setCertInput(e.target.value);
                      if (certError) setCertError(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLookup();
                    }}
                  />
                  {certError ? (
                    <div className="vault-form-error">PSA cert number not found. Please check and try again.</div>
                  ) : null}
                  <TkButton
                    type="button"
                    variant="primary"
                    size="md"
                    className="vault-cert-lookup-btn vault-cert-lookup-btn--full"
                    disabled={lookupLoading}
                    onClick={handleLookup}
                  >
                    {lookupLoading ? "Looking up…" : (
                      <>
                        Look Up <CtaArrow size={12} />
                      </>
                    )}
                  </TkButton>
                </div>
              </div>
            </div>

            <div className="vault-card-list-head">
              <span className="vault-card-list-head__label">CARD LIST</span>
              <span className="vault-card-list-head__count">
                {lookupCards.length} of {MAX_CARDS} cards added
              </span>
            </div>
            <div className="vault-card-list-box">
              {lookupCards.length === 0 ? (
                <div className="vault-card-list-empty">
                  No cards added yet.
                  <br />
                  Scan or enter a cert number above to get started.
                </div>
              ) : (
                lookupCards.map((card, index) => (
                  <div
                    key={`${card.cert}-${index}`}
                    className={cn(
                      "vault-card-row",
                      card.rejected && "vault-card-row--rejected",
                      card.confirmed && !card.rejected && "vault-card-row--confirmed",
                    )}
                    onClick={() => !card.rejected && toggleConfirm(index)}
                    onKeyDown={(e) => e.key === "Enter" && !card.rejected && toggleConfirm(index)}
                    role={card.rejected ? undefined : "button"}
                    tabIndex={card.rejected ? undefined : 0}
                  >
                    <div className="vault-card-row__img">
                      <Image src={card.imageUrl} alt="" width={40} height={56} className="h-full w-full object-contain" />
                    </div>
                    <div className="vault-card-row__body">
                      <div className="vault-card-row__name">{card.name}</div>
                      <div className="vault-card-row__meta">
                        <span className="vault-card-row__grade">{card.grade}</span>
                        <span className="mono vault-card-row__cert">Cert #{card.cert}</span>
                        {card.rejected ? (
                          <span className="vault-card-row__reject-msg">Not accepted — PSA 9 minimum</span>
                        ) : null}
                      </div>
                    </div>
                    {!card.rejected ? (
                      <div className="vault-card-row__confirm">
                        <div className={cn("vault-card-row__confirm-dot", card.confirmed && "checked")}>
                          {card.confirmed ? (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : null}
                        </div>
                        <span className={cn("vault-card-row__confirm-label", card.confirmed && "confirmed")}>
                          {card.confirmed ? "Confirmed" : "Tap to confirm"}
                        </span>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="vault-card-row__remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCard(index);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            {hasValidForConfirm ? (
              <div className="vault-confirm-all-wrap">
                <div className="vault-confirm-all-row">
                  <p className="vault-form-helper vault-form-helper--inline">
                    Tap a card to confirm you&apos;re physically sending it to the vault.
                  </p>
                  <TkButton type="button" variant="subtle" size="sm" onClick={confirmAll}>
                    Confirm All
                  </TkButton>
                </div>
                <div className="vault-disclaimer-amber vault-disclaimer-amber--compact">
                  <WarningIcon />
                  <div>
                    Note: If the card you send doesn&apos;t match the cert number, it will be rejected and returned at
                    your expense.
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="vault-submit-block">
            <div className="vault-section-card vault-section-card--flush">
              <label className="vault-form-label" style={{ marginBottom: 14 }}>
                Submission Details
              </label>
              <div>
                <label className="vault-form-label vault-form-label--sm">Estimated Total Value</label>
                <div className="vault-est-value-wrap">
                  <span className="vault-est-value-prefix">$</span>
                  <input
                    className="vault-form-input vault-form-input--md vault-est-value-input"
                    type="text"
                    placeholder="e.g. 87,512"
                    value={estValue}
                    onChange={(e) => setEstValue(formatEstValue(e.target.value))}
                  />
                </div>
                <div className="vault-form-helper">{estValueRef}</div>
              </div>
            </div>
          </div>

          <div className="vault-section-card">
            <label className="vault-form-label" style={{ marginBottom: 14 }}>
              Token Recipient Wallet
            </label>
            <div className="vault-wallet-connected">
              <span className="vault-wallet-avatar" aria-hidden />
              <span className="mono vault-wallet-connected__addr">0x7Fb3…3aE2</span>
              <div className="vault-wallet-connected__status">
                <CheckIcon />
                <span>Connected</span>
              </div>
            </div>
          </div>

          <div className="vault-section-card">
            <label className="vault-form-label" style={{ marginBottom: 14 }}>
              Notify me via
            </label>
            <div className="vault-notify-stack">
              <label className="vault-notify-check">
                <input type="checkbox" checked readOnly className="vault-notify-checkbox" />
                <div className="vault-notify-check__copy">
                  <div className="vault-notify-check__title">
                    Email <span className="vault-notify-check__hint vault-notify-check__hint--required">(required)</span>
                  </div>
                  <div className="mono vault-notify-check__sub">you@example.com</div>
                </div>
                <CheckIcon />
              </label>

              <div className="vault-notify-tg-row">
                <input
                  type="checkbox"
                  className="vault-notify-checkbox"
                  checked={tgState === "saved"}
                  onChange={() => {
                    if (tgState === "saved") {
                      setTgState("idle");
                      setTgHandle(null);
                    }
                  }}
                />
                <div className="vault-notify-check__copy">
                  <div
                    className={cn(
                      "vault-notify-check__title",
                      tgState === "idle" && "vault-notify-check__title--muted",
                    )}
                  >
                    Telegram <span className="vault-notify-check__hint">(optional)</span>
                  </div>
                  {tgHandle ? (
                    <div className="mono vault-notify-check__sub vault-notify-check__sub--azure">@{tgHandle}</div>
                  ) : null}
                </div>
                <TkButton
                  type="button"
                  variant="subtle"
                  size="sm"
                  className="vault-tg-connect-btn"
                  onClick={() => {
                    if (tgState === "editing") handleSaveTelegram();
                    else setTgState("editing");
                  }}
                >
                  {tgState === "saved" ? "Change" : tgState === "editing" ? "Save" : "Connect →"}
                </TkButton>
              </div>

              {tgState === "editing" ? (
                <div className="vault-tg-input-row">
                  <input
                    className="vault-form-input vault-form-input--sm"
                    type="text"
                    placeholder="@username"
                    value={tgInput}
                    onChange={(e) => setTgInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTelegram();
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="vault-section-card">
            <label className="vault-tos-check">
              <input
                type="checkbox"
                className="vault-notify-checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
              />
              <span>
                I authorize Tokenable to submit these cards to PSA Vault on my behalf and agree to the Terms of Service
                and PSA Vault Terms.
              </span>
            </label>
          </div>

          <div className="vault-disclaimer-amber">
            <WarningIcon />
            <div>
              Only PSA 9 and PSA 10 graded cards are accepted. Cards that do not meet requirements will be rejected and
              returned at the submitter&apos;s expense. All accepted cards are insured up to their appraised market value.
            </div>
          </div>

          <div className="vault-desktop-cta">
            <TkButton
              type="button"
              variant="primary"
              size="md"
              className={cn("vault-submit-cta", submitted && "vault-submit-cta--success")}
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {submitLabel}
              {!submitting && !submitted ? <CtaArrow size={16} /> : null}
            </TkButton>
            <TkButton type="button" variant="subtle" size="md" className="vault-draft-cta">
              Save as Draft
            </TkButton>
          </div>
        </div>

        <aside className="vault-submit-faq">
          <h2 className="vault-submit-faq__title">Frequently Asked Questions</h2>
          <div>
            {VAULT_SUBMIT_FAQ_ITEMS.map((item, i) => (
              <div key={item.q} className="vault-faq-item">
                <button
                  type="button"
                  className="vault-faq-toggle"
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                >
                  <span>{item.q}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="2.5"
                    style={{ transform: faqOpen === i ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div className={cn("vault-faq-body", faqOpen === i && "open")}>
                  <p>{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="vault-mobile-sticky-cta">
        <TkButton
          type="button"
          variant="primary"
          size="md"
          className={cn("vault-submit-cta vault-submit-cta--mobile", submitted && "vault-submit-cta--success")}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {submitted ? "✓ Submitted!" : submitting ? "Submitting…" : "Continue →"}
        </TkButton>
      </div>

      {scanOpen ? (
        <div className="vault-scan-modal" role="dialog" aria-modal="true" aria-label="Scan PSA cert">
          <div className="vault-scan-modal__viewfinder" />
          <div className={`vault-scan-modal__flash${scanCapturing ? " vault-scan-modal__flash--on" : ""}`} />
          <button type="button" className="vault-scan-modal__cancel" onClick={() => setScanOpen(false)}>
            ×
          </button>
          <div className="vault-scan-modal__body">
            <div className="vault-scan-modal__frame">
              <div className="vault-scan-modal__corner vault-scan-modal__corner--tl" />
              <div className="vault-scan-modal__corner vault-scan-modal__corner--tr" />
              <div className="vault-scan-modal__corner vault-scan-modal__corner--bl" />
              <div className="vault-scan-modal__corner vault-scan-modal__corner--br" />
              <span className="vault-scan-modal__frame-label">CERT NUMBER HERE</span>
              <div
                className={`vault-scan-modal__ocr${scanCapturing ? " vault-scan-modal__ocr--on" : ""}`}
                aria-hidden
              />
            </div>
            <div className="vault-scan-modal__status">
              {scanCapturing ? "Reading cert number…" : "Frame the cert number, then tap to capture"}
            </div>
            <p className="vault-scan-modal__hint">
              We&apos;ll read the number automatically — no need to type it
            </p>
          </div>
          <button
            type="button"
            className="vault-scan-modal__shutter"
            onClick={handleScanCapture}
            disabled={scanCapturing}
            aria-label={scanCapturing ? "Capturing" : "Capture"}
          />
        </div>
      ) : null}
    </>
  );
}
