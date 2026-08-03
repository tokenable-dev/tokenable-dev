"use client";

import Link from "next/link";
import { useRedeemFlow } from "@/hooks/portfolio/useRedeemFlow";
import { RedeemRequestPanel } from "./RedeemRequestPanel";
import { RedeemRequestedPanel } from "./RedeemRequestedPanel";
import { RedeemPayPanel } from "./RedeemPayPanel";
import { RedeemTransitPanel } from "./RedeemTransitPanel";
import { RedeemDonePanel } from "./RedeemDonePanel";

export function RedeemFlowView() {
  const flow = useRedeemFlow();

  if (!flow.hydrated || (!flow.draft && flow.step === "request")) {
    return (
      <div className="pf-redeem-page">
        <p className="sell-flow-sub">Loading…</p>
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
          onSubmit={() => void flow.submitRequest()}
        />
      ) : null}

      {flow.step === "requested" ? (
        <RedeemRequestedPanel count={flow.successCount || flow.cards.length} />
      ) : null}

      {flow.step === "pay" ? (
        <RedeemPayPanel
          cards={flow.cards}
          form={flow.form}
          onEditAddress={flow.goRequest}
        />
      ) : null}

      {flow.step === "transit" ? <RedeemTransitPanel cards={flow.cards} /> : null}

      {flow.step === "done" ? <RedeemDonePanel /> : null}
    </div>
  );
}
