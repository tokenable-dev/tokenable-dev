"use client";

import { useQuery } from "@tanstack/react-query";
import { TkButton } from "@/components/ds";
import {
  formatRedeemUsd,
  getRedeemEstimate,
} from "@/lib/core/api/rwa-redeem";
import { composeShipToPhone } from "@/lib/shipping/shipToValidation";
import { PHONE_DIAL_CODE_VALUES } from "@/lib/shipping/phoneDialOptions";
import { redeemDestinationCountryCode } from "@/lib/shipping/redeemDestinationCountryCode";
import type {
  RedeemAddressForm,
  RedeemDraftCard,
} from "@/lib/portfolio/redeemDraft";
import type { RedeemPayPhase } from "@/hooks/portfolio/useRedeemFlow";
import { useAppChain } from "@/providers/AppChainProvider";
import { useAppStore } from "@/store";
import { RedeemCardSummary } from "./RedeemCardSummary";
import { RedeemCostBreakdown } from "./RedeemCostBreakdown";

function busyLabel(phase: RedeemPayPhase): string {
  switch (phase?.kind) {
    case "quote":
      return "Confirming final cost…";
    case "pay":
      return "Confirm the USDC payment in your wallet…";
    case "record":
      return "Recording your payment…";
    case "custody":
      return phase.total > 1
        ? `Transferring card ${phase.current} of ${phase.total} — confirm in wallet…`
        : "Transferring your card — confirm in wallet…";
    default:
      return "Working…";
  }
}

/**
 * Step 2 — review & pay USDC, or finish NFT→custody if payment already recorded.
 */
export function RedeemPayPanel({
  cards,
  form,
  busy,
  payPhase = null,
  error,
  onEditAddress,
  onPay,
  custodyPending = false,
  onResumeCustody,
}: {
  cards: RedeemDraftCard[];
  form: RedeemAddressForm;
  busy: boolean;
  payPhase?: RedeemPayPhase;
  error: string | null;
  onEditAddress: () => void;
  onPay: () => void;
  /** USDC already recorded — only NFT transfers remain. */
  custodyPending?: boolean;
  onResumeCustody?: () => void;
}) {
  const { chainId } = useAppChain();
  const usdcBalanceFormatted = useAppStore((s) => s.usdcBalanceFormatted);
  const tokenIds = cards.map((c) => c.tokenId);
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
  const estimateQuery = useQuery({
    queryKey: [
      "rwa",
      "redeem",
      "estimate",
      form.country,
      shipTo.countryCode,
      form.postal,
      form.city,
      tokenIds.join(","),
      chainId,
    ],
    queryFn: () =>
      getRedeemEstimate({
        country: form.country,
        cardCount: Math.max(1, cards.length),
        tokenIds,
        chainId,
        shipTo,
      }),
    enabled: cards.length > 0 && !custodyPending,
    staleTime: 30_000,
  });
  const est = estimateQuery.data;
  const phoneLine = shipTo.phone;

  return (
    <div className="pf-redeem-panel">
      <div className="pf-redeem-eyebrow">Ship from vault · Step 2 of 2</div>
      <h1 className="pf-redeem-h1">
        {custodyPending ? "Finish NFT transfer" : "Review & pay"}
      </h1>
      <p className="pf-redeem-sub">
        {custodyPending
          ? "Your USDC payment is already recorded. Confirm each NFT transfer into Tokenable custody to continue — do not pay again."
          : "This is the final amount and it\u2019s charged now. After payment you will sign NFT transfers into Tokenable custody, then we start preparing your shipment."}
      </p>

      <RedeemCardSummary cards={cards} />

      {!custodyPending ? (
        <div className="pf-redeem-cost">
          <RedeemCostBreakdown
            est={est}
            loading={estimateQuery.isLoading}
            cardCount={cards.length}
            embed
            title="Total charged now"
          />
          <p className="pf-redeem-cost__copy">Matches — no markup.</p>
        </div>
      ) : (
        <div className="pf-redeem-cost">
          <div className="pf-redeem-cost__title">Payment status</div>
          <p className="pf-redeem-cost__copy" style={{ marginTop: 0 }}>
            Paid — waiting for NFT custody transfers. You can leave and return
            later; we&rsquo;ll pick up where you left off.
          </p>
        </div>
      )}

      <div className="pf-redeem-shipto pf-redeem-shipto--row">
        <div>
          <div className="pf-redeem-cost__title">Ship to</div>
          <p className="pf-redeem-shipto__body">
            {form.name}
            <br />
            <span className="pf-redeem-shipto__muted">
              {[form.line1, form.line2].filter(Boolean).join(", ")}
              <br />
              {[form.city, form.region, form.postal].filter(Boolean).join(", ")}
              {phoneLine ? (
                <>
                  <br />
                  {phoneLine}
                </>
              ) : null}
            </span>
          </p>
        </div>
        {!custodyPending ? (
          <TkButton
            type="button"
            variant="subtle"
            className="pf-redeem-edit-btn"
            onClick={onEditAddress}
            disabled={busy}
          >
            Edit
          </TkButton>
        ) : null}
      </div>

      {!custodyPending ? (
        <div className="pf-redeem-paybox">
          <div className="pf-redeem-cost__title">Payment</div>
          <p className="pf-redeem-paybox__copy">
            Account balance{" "}
            <span className="tkl-mono pf-redeem-paybox__bal">
              {usdcBalanceFormatted} USDC
            </span>
          </p>
          <p className="pf-redeem-cost__copy">
            Charged as a USDC transfer to the Tokenable fee wallet.
          </p>
        </div>
      ) : null}

      <div className="pf-redeem-paybox">
        <div className="pf-redeem-cost__title">
          What your wallet will ask you to sign
        </div>
        <ol className="pf-redeem-sign-steps">
          {!custodyPending ? (
            <li>
              <strong>USDC payment</strong> — one transfer
              {est ? ` of ${formatRedeemUsd(est.totalUsd)} USDC` : ""} to the
              Tokenable fee wallet. This covers shipping and vault fees — the
              exact amount shown above, nothing else.
            </li>
          ) : null}
          <li>
            <strong>
              {cards.length === 1
                ? "1 card transfer"
                : `${cards.length} card transfers`}
            </strong>{" "}
            — one confirmation per card, moving each card&rsquo;s NFT into
            Tokenable custody. This proves you gave up the token in exchange
            for the physical card. No USDC is charged by these transfers.
          </li>
        </ol>
        <p className="pf-redeem-cost__copy">
          If you close your wallet mid-way, nothing is lost — come back and
          we&rsquo;ll resume exactly where you stopped, without charging again.
        </p>
      </div>

      {error ? (
        <p className="pf-redeem-error" role="alert">
          {error}
        </p>
      ) : null}

      {custodyPending ? (
        <>
          <TkButton
            type="button"
            variant="primary"
            className="pf-redeem-primary"
            disabled={busy || cards.length === 0}
            onClick={() => (onResumeCustody ? onResumeCustody() : onPay())}
          >
            {busy ? busyLabel(payPhase) : "Finish NFT transfers"}
          </TkButton>
          <p className="pf-redeem-hint-below">
            Your wallet will ask you to transfer each remaining card into
            custody. No additional USDC is charged.
          </p>
        </>
      ) : (
        <>
          <TkButton
            type="button"
            variant="primary"
            className="pf-redeem-primary"
            disabled={
              busy || cards.length === 0 || estimateQuery.isLoading || !est
            }
            onClick={onPay}
          >
            {busy
              ? busyLabel(payPhase)
              : est
                ? `Pay ${formatRedeemUsd(est.totalUsd)} USDC & ship`
                : "Pay and ship"}
          </TkButton>
          <p className="pf-redeem-hint-below">
            While your cards are on their way, Tokenable holds their ownership
            for you.
          </p>
        </>
      )}
    </div>
  );
}
