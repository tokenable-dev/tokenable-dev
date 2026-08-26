"use client";

import Link from "next/link";
import { RedeemPayPanel } from "./RedeemPayPanel";
import { RedeemPreparingPanel } from "./RedeemPreparingPanel";
import { RedeemRequestPanel } from "./RedeemRequestPanel";
import { RedeemTransitPanel } from "./RedeemTransitPanel";
import { RedeemDonePanel } from "./RedeemDonePanel";
import { useRedeemFlow } from "@/hooks/portfolio/useRedeemFlow";

export function RedeemFlowView() {
  const flow = useRedeemFlow();

  const needsCards = flow.step === "request" || flow.step === "pay";
  if (!flow.hydrated) {
    return (
      <div className="pf-redeem-page">
        <p className="sell-flow-sub">Loading…</p>
      </div>
    );
  }

  if (needsCards && flow.cards.length === 0) {
    return (
      <div className="pf-redeem-page">
        <nav className="pf-redeem-crumb" aria-label="Breadcrumb">
          <Link href="/portfolio">Portfolio</Link>
          <span className="pf-redeem-crumb__sep" aria-hidden>
            ›
          </span>
          <span className="pf-redeem-crumb__current">Redeem</span>
        </nav>
        <p className="sell-flow-sub">
          No open request to finish.{" "}
          <Link href="/portfolio">Back to portfolio</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="pf-redeem-page">
      <nav className="pf-redeem-crumb" aria-label="Breadcrumb">
        <Link href="/portfolio">Portfolio</Link>
        <span className="pf-redeem-crumb__sep" aria-hidden>
          ›
        </span>
        <span className="pf-redeem-crumb__current">Redeem</span>
      </nav>

      {flow.step === "request" ? (
        <RedeemRequestPanel
          cards={flow.cards}
          form={flow.form}
          onChange={flow.setForm}
          onRemoveCard={flow.removeCard}
          busy={flow.busy}
          error={flow.error}
          onContinue={() => void flow.goToPay()}
        />
      ) : null}

      {flow.step === "pay" ? (
        <RedeemPayPanel
          cards={flow.cards}
          form={flow.form}
          busy={flow.busy}
          payPhase={flow.payPhase}
          error={flow.error}
          onEditAddress={flow.goRequest}
          onPay={() => void flow.submitPay()}
          custodyPending={Boolean(flow.custodyPending)}
          onResumeCustody={() => void flow.resumeCustody()}
        />
      ) : null}

      {flow.step === "preparing" ? (
        <RedeemPreparingPanel
          cards={flow.cards}
          form={flow.form}
          shipments={flow.shipments}
        />
      ) : null}

      {flow.step === "transit" ? (
        <RedeemTransitPanel
          cards={flow.cards}
          shipments={flow.shipments}
          busy={flow.busy}
          error={flow.error}
          onConfirmReceived={() => void flow.confirmReceived()}
        />
      ) : null}

      {flow.step === "done" ? <RedeemDonePanel /> : null}
    </div>
  );
}
