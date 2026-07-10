"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { TkButton } from "@/components/ds";
import { ASSETS } from "@/constants/assets";
import { VaultBreadcrumb } from "@/components/vault/VaultBreadcrumb";
import { VaultStepper } from "@/components/vault/VaultStepper";
import { VAULT_SUBMIT_FAQ_ITEMS } from "@/lib/vault/vaultMockData";
import { cn } from "@/lib/ds/cn";

type LookupCard = {
  cert: string;
  name: string;
  grade: string;
  rejected: boolean;
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

export function VaultSubmitDesignView() {
  const router = useRouter();
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
  const [showCertInput, setShowCertInput] = useState(true);

  const [numCards, setNumCards] = useState("");
  const [estValue, setEstValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [tgState, setTgState] = useState<"idle" | "editing" | "saved">("idle");
  const [tgInput, setTgInput] = useState("");
  const [tgHandle, setTgHandle] = useState<string | null>(null);

  const hasRejected = lookupCards.some((c) => c.rejected);
  const estValueNum = parseFloat(estValue.replace(/[^0-9.]/g, ""));
  const numCardsNum = parseInt(numCards, 10);
  const canSubmit =
    !submitting &&
    !submitted &&
    numCardsNum >= 1 &&
    estValueNum > 0 &&
    !hasRejected;

  const handleLookup = useCallback(() => {
    const val = certInput.trim();
    if (val.length < 6) {
      setCertError(true);
      return;
    }
    setCertError(false);
    setLookupLoading(true);
    window.setTimeout(() => {
      setLookupCards((prev) => [...prev, resolveLookupCard(val)]);
      setCertInput("");
      setShowCertInput(false);
      setLookupLoading(false);
    }, 1200);
  }, [certInput]);

  const handleRemoveCard = useCallback((index: number) => {
    setLookupCards((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setShowCertInput(true);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      window.setTimeout(() => router.push("/vault/submit/shipping"), 1200);
    }, 1500);
  }, [canSubmit, router]);

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

  return (
    <>
      <VaultBreadcrumb items={[{ label: "My Vault", href: "/vault" }, { label: "Submit Card" }]} />

      <h1 className="vault-submit-title">Submit a Card</h1>

      <div className="vault-submit-layout">
        <div className="vault-submit-main">
          <VaultStepper active={1} />

          <div className="vault-cert-section">
            <label className="vault-form-label vault-cert-label">
              <img src={ASSETS.icons.psaMarkSubmit} alt="PSA" className="vault-cert-label__logo" />
              Certification Number
            </label>
            <p className="vault-form-helper vault-form-helper--tight">
              Optional — look up cards you want to verify before submitting
            </p>

            {showCertInput ? (
              <div className="vault-cert-input-row">
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
                <TkButton
                  type="button"
                  variant="primary"
                  size="md"
                  className="vault-cert-lookup-btn"
                  disabled={lookupLoading}
                  onClick={handleLookup}
                >
                  {lookupLoading ? "Looking up…" : (
                    <>
                      Look Up Card <CtaArrow />
                    </>
                  )}
                </TkButton>
              </div>
            ) : null}
            {certError ? (
              <div className="vault-form-error">Please enter a valid PSA cert number (at least 6 digits)</div>
            ) : null}
          </div>

          {lookupCards.length > 0 ? (
            <div className="vault-lookup-list">
              {lookupCards.map((card, index) => (
                <div
                  key={`${card.cert}-${index}`}
                  className={cn("vault-lookup-card", card.rejected && "vault-lookup-card--rejected")}
                >
                  <div className="vault-lookup-card__img">
                    <Image src={card.imageUrl} alt="" width={50} height={72} className="h-full w-full object-contain" />
                  </div>
                  <div className="vault-lookup-card__body">
                    <div className="vault-lookup-card__name">{card.name}</div>
                    <div className="vault-lookup-card__meta">
                      <span className="vault-lookup-card__grade">{card.grade}</span>
                      <span className="mono vault-lookup-card__cert">Cert #{card.cert}</span>
                      {card.rejected ? (
                        <span className="vault-lookup-card__status vault-lookup-card__status--neg">
                          🔴 Not accepted — PSA 9 minimum
                        </span>
                      ) : (
                        <span className="vault-lookup-card__status vault-lookup-card__status--pos">
                          ✅ Valid
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="vault-lookup-card__remove"
                    onClick={() => handleRemoveCard(index)}
                  >
                    Remove ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {!showCertInput && lookupCards.length > 0 ? (
            <div className="vault-add-another-wrap">
              <TkButton
                type="button"
                variant="subtle"
                size="sm"
                className="vault-add-another-btn"
                onClick={() => setShowCertInput(true)}
              >
                + Look Up Another Card
              </TkButton>
            </div>
          ) : null}

          <div className="vault-submit-block">
            <div className="vault-section-card vault-section-card--flush">
              <label className="vault-form-label" style={{ marginBottom: 14 }}>
                Submission Details
              </label>
              <div className="vault-submit-details-stack">
              <div>
                <label className="vault-form-label vault-form-label--sm">Number of Cards</label>
                <input
                  className="vault-form-input vault-form-input--md"
                  type="number"
                  min={1}
                  max={99}
                  placeholder="e.g. 5"
                  value={numCards}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setNumCards("");
                      return;
                    }
                    const n = parseInt(v, 10);
                    if (Number.isNaN(n)) return;
                    setNumCards(String(Math.min(99, Math.max(1, n))));
                  }}
                />
                <div className="vault-form-helper">Total cards you&apos;re sending (max 99)</div>
              </div>
              <div>
                <label className="vault-form-label vault-form-label--sm">Estimated Value</label>
                <div className="vault-est-value-wrap">
                  <span className="vault-est-value-prefix">$</span>
                  <input
                    className="vault-form-input vault-form-input--md vault-est-value-input"
                    type="text"
                    placeholder="e.g. 50,000"
                    value={estValue}
                    onChange={(e) => setEstValue(formatEstValue(e.target.value))}
                  />
                </div>
                <div className="vault-form-helper">
                  Total value of all cards. Used for insurance and PSA records.
                </div>
              </div>
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
                    <div className="mono vault-notify-check__sub vault-notify-check__sub--azure">
                      @{tgHandle}
                    </div>
                  ) : null}
                </div>
                <TkButton
                  type="button"
                  variant="subtle"
                  size="sm"
                  className="vault-tg-connect-btn"
                  onClick={() => {
                    if (tgState === "editing") handleSaveTelegram();
                    else {
                      setTgState("editing");
                    }
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

          <div className="vault-disclaimer-amber">
            <WarningIcon />
            <div>
              Only PSA 9 and PSA 10 graded cards are accepted. Cards that do not meet requirements will be rejected
              and returned at the submitter&apos;s expense. All accepted cards are insured up to their appraised
              market value.
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
    </>
  );
}
