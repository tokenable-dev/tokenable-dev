"use client";

import { useEffect, useMemo, useState } from "react";
import { TkButton } from "@/components/ds";
import {
  ShippingAddressFormFields,
  type ShippingAddressFormValues,
} from "@/components/shipping/ShippingAddressFormFields";
import {
  getRedeemEstimate,
  type RedeemEstimate,
} from "@/lib/core/api/rwa-redeem";
import type {
  RedeemAddressForm,
  RedeemDraftCard,
} from "@/lib/portfolio/redeemDraft";
import {
  phoneDialLensFor,
  PHONE_DIAL_CODE_VALUES,
} from "@/lib/shipping/phoneDialOptions";
import {
  composeShipToPhone,
  firstShipToErrorKey,
  type ShipToFieldErrors,
  validateShipToFields,
} from "@/lib/shipping/shipToValidation";
import { redeemDestinationCountryCode } from "@/lib/shipping/redeemDestinationCountryCode";
import { resolveHeaderNavGate } from "@/lib/auth/accountAccess";
import { useAccessGate } from "@/hooks/auth/useAccessGate";
import { useAuthStore } from "@/store/authStore";
import { useAppChain } from "@/providers/AppChainProvider";
import { RedeemAccessGate, RedeemVerifiedChip } from "./RedeemAccessGate";
import { RedeemCardSummary } from "./RedeemCardSummary";
import { RedeemCostBreakdown } from "./RedeemCostBreakdown";

const REDEEM_RETURN_TO = "/portfolio/redeem";

type QuoteState = "idle" | "loading" | "done" | "stale";
type StaleReason = "address" | "cards" | "both";

function formAddressKey(form: RedeemAddressForm): string {
  return [
    form.name,
    form.line1,
    form.line2 ?? "",
    form.city,
    form.region ?? "",
    form.postal,
    form.country,
    form.phoneDial,
    form.phone,
  ].join("|");
}

function formCardsKey(tokenIds: number[]): string {
  return tokenIds.join(",");
}

function quoteSnapshotKey(form: RedeemAddressForm, tokenIds: number[]): string {
  return `${formAddressKey(form)}||${formCardsKey(tokenIds)}`;
}

function staleReasonFromKeys(
  quotedKey: string,
  nextKey: string,
): StaleReason {
  const [qAddr = "", qCards = ""] = quotedKey.split("||");
  const [nAddr = "", nCards = ""] = nextKey.split("||");
  const addrChanged = qAddr !== nAddr;
  const cardsChanged = qCards !== nCards;
  if (addrChanged && cardsChanged) return "both";
  if (cardsChanged) return "cards";
  return "address";
}

const STALE_COPY: Record<
  StaleReason,
  { badge: string; note: string }
> = {
  address: {
    badge: "Address changed",
    note: "Address changed. Recalculate the cost.",
  },
  cards: {
    badge: "Cards changed",
    note: "Your card selection changed — recalculate to update shipping and fees.",
  },
  both: {
    badge: "Details changed",
    note: "Your address or cards changed — recalculate to get an updated cost.",
  },
};

const QUOTE_BADGE: Record<
  Exclude<QuoteState, "stale">,
  { label: string; tone: "idle" | "loading" | "done" | "stale" }
> = {
  idle: { label: "Not calculated", tone: "idle" },
  loading: { label: "Calculating", tone: "loading" },
  done: { label: "Quoted", tone: "done" },
};

function RedeemRequestHeader() {
  return (
    <>
      <div className="pf-redeem-eyebrow">Redeem · Step 1 of 2</div>
      <h1 className="pf-redeem-h1">Have your cards shipped to you</h1>
      <p className="pf-redeem-sub">
        Ship your physical cards from the vault to the address below.
      </p>
    </>
  );
}

export function RedeemRequestPanel({
  cards,
  form,
  onChange,
  onRemoveCard,
  busy = false,
  error,
  onContinue,
}: {
  cards: RedeemDraftCard[];
  form: RedeemAddressForm;
  onChange: (next: RedeemAddressForm) => void;
  onRemoveCard: (tokenId: number) => void;
  busy?: boolean;
  error: string | null;
  onContinue: () => void;
}) {
  const { chainId } = useAppChain();
  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.initialized);
  const { runAccessGate } = useAccessGate(2, REDEEM_RETURN_TO);
  const gate = resolveHeaderNavGate(user, 2, REDEEM_RETURN_TO);
  const tokenIds = cards.map((c) => c.tokenId);
  const quoteKey = useMemo(
    () => quoteSnapshotKey(form, tokenIds),
    [form, tokenIds],
  );

  const [fieldErrors, setFieldErrors] = useState<ShipToFieldErrors>({});
  const [quoteState, setQuoteState] = useState<QuoteState>("idle");
  const [quotedKey, setQuotedKey] = useState("");
  const [staleReason, setStaleReason] = useState<StaleReason>("address");
  const [est, setEst] = useState<RedeemEstimate | undefined>();
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(8);

  useEffect(() => {
    if (quoteState === "done" && quotedKey && quoteKey !== quotedKey) {
      setStaleReason(staleReasonFromKeys(quotedKey, quoteKey));
      setQuoteState("stale");
    }
  }, [quoteKey, quotedKey, quoteState]);

  useEffect(() => {
    if (quoteState !== "loading") return;
    setLoadProgress(8);
    const t = window.setInterval(() => {
      setLoadProgress((p) => Math.min(96, p + Math.random() * 22));
    }, 260);
    return () => window.clearInterval(t);
  }, [quoteState]);

  const shipValues: ShippingAddressFormValues = {
    name: form.name,
    line1: form.line1,
    line2: form.line2 ?? "",
    city: form.city,
    region: form.region ?? "",
    postal: form.postal,
    country: form.country,
    phone: form.phone,
    phoneDial: form.phoneDial || "+1",
  };

  const patchForm = (next: ShippingAddressFormValues) => {
    const dial = next.phoneDial ?? form.phoneDial ?? "+1";
    onChange({
      ...form,
      name: next.name,
      line1: next.line1,
      line2: next.line2,
      city: next.city,
      region: next.region,
      postal: next.postal,
      country: next.country,
      phone: next.phone,
      phoneDial: dial,
    });
    setFieldErrors({});
    setQuoteError(null);
  };

  const runQuote = async () => {
    const errors = validateShipToFields({
      name: form.name,
      line1: form.line1,
      city: form.city,
      region: form.region ?? "",
      postal: form.postal,
      country: form.country,
      phone: form.phone,
      phoneDial: form.phoneDial || "+1",
      phoneDialLens: phoneDialLensFor(form.phoneDial || "+1"),
    });
    setFieldErrors(errors);
    const first = firstShipToErrorKey(errors);
    if (first) {
      const el = document.getElementById(`redeem-${first === "line1" ? "line1" : first}`);
      if (el) {
        el.focus({ preventScroll: true });
        window.scrollTo({
          top: el.getBoundingClientRect().top + window.scrollY - 140,
          behavior: "smooth",
        });
      }
      return;
    }

    setQuoteError(null);
    setQuoteState("loading");
    try {
      const shipTo = {
        name: form.name.trim(),
        line1: form.line1.trim(),
        line2: form.line2?.trim() || undefined,
        city: form.city.trim(),
        region: form.region?.trim() || undefined,
        postal: form.postal.trim(),
        country: form.country,
        countryCode: redeemDestinationCountryCode({
          country: form.country,
          phoneDial: form.phoneDial || "+1",
        }),
        phone: composeShipToPhone(
          form.phoneDial || "+1",
          form.phone,
          PHONE_DIAL_CODE_VALUES,
        ),
      };
      const next = await getRedeemEstimate({
        country: form.country,
        cardCount: Math.max(1, cards.length),
        tokenIds,
        chainId,
        shipTo,
      });
      setEst(next);
      setQuotedKey(quoteKey);
      setLoadProgress(100);
      setQuoteState("done");
    } catch (e) {
      setQuoteState("idle");
      setQuoteError(
        e instanceof Error ? e.message : "Could not calculate the cost.",
      );
    }
  };

  const badge =
    quoteState === "stale"
      ? { label: STALE_COPY[staleReason].badge, tone: "stale" as const }
      : QUOTE_BADGE[quoteState];

  if (!authReady) {
    return (
      <div className="pf-redeem-panel">
        <RedeemRequestHeader />
        <div className="pf-redeem-gate pf-redeem-gate--loading" aria-hidden />
      </div>
    );
  }

  if (gate.action !== "allow") {
    return (
      <div className="pf-redeem-panel">
        <RedeemRequestHeader />
        <RedeemAccessGate
          action={gate.action}
          kycStatus={user?.kycStatus}
          onContinue={() => runAccessGate()}
        />
      </div>
    );
  }

  return (
    <div className="pf-redeem-panel">
      <RedeemRequestHeader />
      <RedeemVerifiedChip />

      <ShippingAddressFormFields
        idPrefix="redeem"
        value={shipValues}
        disabled={busy || quoteState === "loading"}
        showPhoneDial
        fieldErrors={fieldErrors}
        onChange={patchForm}
        addressSearchLabel="Delivery address"
        extrasAfter={
          <label className="tk-ship-cbx">
            <input
              type="checkbox"
              checked={form.saveAddress}
              disabled={busy}
              onChange={(e) =>
                onChange({ ...form, saveAddress: e.target.checked })
              }
            />
            Save this address for future shipments
          </label>
        }
      />

      <RedeemCardSummary cards={cards} onRemove={onRemoveCard} />

      <div
        className={[
          "pf-redeem-cost pf-redeem-quote",
          `pf-redeem-quote--${quoteState}`,
        ].join(" ")}
      >
        <div className="pf-redeem-quote__head">
          <span className="pf-redeem-cost__title pf-redeem-quote__label">
            Cost
          </span>
          <span
            className={`pf-redeem-quote__badge pf-redeem-quote__badge--${badge.tone} tkl-mono`}
          >
            {badge.label}
          </span>
        </div>

        <div className="pf-redeem-quote__stage">
          {quoteState === "idle" ? (
            <div className="pf-redeem-quote__body">
              <p className="pf-redeem-quote__intro">
                Enter your address, then calculate the cost.
              </p>
              <TkButton
                type="button"
                variant="primary"
                className="pf-redeem-primary pf-redeem-quote-btn"
                disabled={busy || cards.length === 0}
                onClick={() => void runQuote()}
              >
                Calculate cost
              </TkButton>
            </div>
          ) : null}

          {quoteState === "loading" ? (
            <div className="pf-redeem-quote__body pf-redeem-quote__body--loading" aria-busy="true">
              <div className="pf-redeem-quote__loading-row">
                <span className="pf-redeem-quote__spin" aria-hidden />
                <span className="pf-redeem-quote__loading-copy">
                  Getting rates for your address…
                </span>
              </div>
              <div className="pf-redeem-quote__bar" aria-hidden>
                <div
                  className="pf-redeem-quote__bar-fill"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
            </div>
          ) : null}

          {quoteState === "done" ? (
            <div className="pf-redeem-quote__body pf-redeem-quote__body--result">
              <RedeemCostBreakdown
                est={est}
                loading={false}
                cardCount={cards.length}
                embed
                title={null}
              />
              <p className="pf-redeem-cost__copy">
                Final price. Billed once per shipment.
              </p>
            </div>
          ) : null}

          {quoteState === "stale" ? (
            <div className="pf-redeem-quote__body">
              <p className="pf-redeem-quote__stale-note" role="note">
                {STALE_COPY[staleReason].note}
              </p>
              <TkButton
                type="button"
                variant="primary"
                className="pf-redeem-primary pf-redeem-quote-btn"
                disabled={busy || cards.length === 0}
                onClick={() => void runQuote()}
              >
                Recalculate
              </TkButton>
            </div>
          ) : null}
        </div>
      </div>

      {quoteError ? (
        <p className="pf-redeem-error" role="alert">
          {quoteError}
        </p>
      ) : null}
      {error ? (
        <p className="pf-redeem-error" role="alert">
          {error}
        </p>
      ) : null}

      {quoteState === "done" ? (
        <div className="pf-redeem-quote__continue">
          <TkButton
            type="button"
            variant="primary"
            className="pf-redeem-primary"
            disabled={busy || cards.length === 0 || !est}
            onClick={onContinue}
          >
            {busy
              ? "Saving…"
              : cards.length === 0
                ? "No cards selected"
                : "Continue"}
          </TkButton>
          <p className="pf-redeem-hint-below">
            Shipping and the Redemption fee, charged now.
          </p>
        </div>
      ) : null}
    </div>
  );
}
