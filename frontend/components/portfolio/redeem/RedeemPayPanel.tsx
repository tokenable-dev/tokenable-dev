"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { TkButton } from "@/components/ds";
import { getRedeemEstimate } from "@/lib/core/api/rwa-redeem";
import { composeShipToPhone } from "@/lib/shipping/shipToValidation";
import { PHONE_DIAL_CODE_VALUES } from "@/lib/shipping/phoneDialOptions";
import { redeemDestinationCountryCode } from "@/lib/shipping/redeemDestinationCountryCode";
import type {
  RedeemAddressForm,
  RedeemDraftCard,
} from "@/lib/portfolio/redeemDraft";
import type { RedeemPayPhase } from "@/hooks/portfolio/useRedeemFlow";
import { useAppChain } from "@/providers/AppChainProvider";
import { formatUsdcAmount } from "@/lib/market/displayMoney";
import { useAppStore } from "@/store";
import { RedeemCostBreakdown } from "./RedeemCostBreakdown";

function busyLabel(
  phase: RedeemPayPhase,
  t: ReturnType<typeof useTranslations<"Portfolio">>,
): string {
  switch (phase?.kind) {
    case "quote":
      return t("confirmingCost");
    case "pay":
      return t("confirmPay");
    case "record":
      return t("recording");
    case "custody":
      return phase.total > 1
        ? t("transferringMany", { current: phase.current, total: phase.total })
        : t("transferring");
    default:
      return t("working");
  }
}

/**
 * Step 2 — review and pay USDC, or finish NFT→custody if payment already recorded.
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
  const t = useTranslations("Portfolio");
  const ui = useTranslations("RedeemUi");
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
      <div className="pf-redeem-eyebrow">{ui("step2")}</div>
      <h1
        className={`pf-redeem-h1${custodyPending ? "" : " pf-redeem-h1--review"}`}
      >
        {custodyPending ? ui("finishTransferTitle") : ui("review")}
      </h1>
      {custodyPending ? (
        <p className="pf-redeem-sub">{ui("finishTransferSub")}</p>
      ) : null}

      {!custodyPending ? (
        <div className="pf-redeem-cost">
          <RedeemCostBreakdown
            est={est}
            loading={estimateQuery.isLoading}
            cardCount={cards.length}
            embed
            title={null}
          />
        </div>
      ) : (
        <div className="pf-redeem-cost">
          <div className="pf-redeem-cost__title">{ui("paymentStatus")}</div>
          <p className="pf-redeem-cost__copy" style={{ marginTop: 0 }}>
            {ui("paidWaiting")}
          </p>
        </div>
      )}

      <div className="pf-redeem-shipto pf-redeem-shipto--row">
        <div>
          <div className="pf-redeem-cost__title">{ui("shipTo")}</div>
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
            {ui("edit")}
          </TkButton>
        ) : null}
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
            {busy ? busyLabel(payPhase, t) : t("finishTransfers")}
          </TkButton>
          <p className="pf-redeem-hint-below">{ui("custodyHint")}</p>
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
            {busy ? busyLabel(payPhase, t) : t("pay")}
          </TkButton>
          <p className="pf-redeem-hint-below">
            {ui("balanceLead")}{" "}
            <span className="tkl-mono pf-redeem-paybox__bal">
              {Number.isFinite(Number(usdcBalanceFormatted))
                ? formatUsdcAmount(Number(usdcBalanceFormatted))
                : "—"}
            </span>
            {" · "}
            {ui("balanceTail")}
          </p>
        </>
      )}
    </div>
  );
}
