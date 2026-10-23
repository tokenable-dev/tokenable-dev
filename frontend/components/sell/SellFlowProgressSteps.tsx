"use client";

import type { ReactNode } from "react";

/** PSA-Shipping.html step rail: Submit → Ship → PSA → Live */
export type SellProgressPhase = "submit" | "ship" | "psa" | "live";

type Props = {
  phase: SellProgressPhase;
  shipInTransit?: boolean;
  shipSublabel?: string;
  submitDone?: boolean;
  canGoSubmit?: boolean;
  canGoShip?: boolean;
  canGoLive?: boolean;
  onSubmit?: () => void;
  onShip?: () => void;
  onLive?: () => void;
};

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(17,17,17,0.45)" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function StepButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  if (!onClick) return <>{children}</>;
  return (
    <button type="button" className="psa-ship-step__hit" onClick={onClick}>
      {children}
    </button>
  );
}

/** Submit → Ship → PSA → Live, matching PSA-Shipping.html. */
export function SellFlowProgressSteps({
  shipSublabel,
  canGoSubmit = false,
  canGoShip = false,
  canGoLive = false,
  onSubmit,
  onShip,
  onLive,
}: Props) {
  return (
    <div className="psa-ship-steps" role="list" aria-label="Progress">
      <div className="psa-ship-step" role="listitem">
        <StepButton onClick={onSubmit && canGoSubmit ? onSubmit : undefined}>
          <div className="psa-ship-step__circle psa-ship-step__circle--done">
            <Check />
          </div>
          <div className="psa-ship-step__label psa-ship-step__label--done">Submit</div>
        </StepButton>
      </div>
      <div className="psa-ship-step__line psa-ship-step__line--done" aria-hidden />
      <div className="psa-ship-step" role="listitem">
        <StepButton onClick={onShip && canGoShip ? onShip : undefined}>
          <div className="psa-ship-step__circle psa-ship-step__circle--active">
            <span className="psa-ship-step__spin" />
          </div>
          <div className="psa-ship-step__label">Ship</div>
          {shipSublabel ? <div className="psa-ship-step__sub">{shipSublabel}</div> : null}
        </StepButton>
      </div>
      <div className="psa-ship-step__line" aria-hidden />
      <div className="psa-ship-step" role="listitem">
        <div className="psa-ship-step__circle psa-ship-step__circle--idle">
          <span className="psa-ship-step__dot" />
        </div>
        <div className="psa-ship-step__label psa-ship-step__label--idle">PSA</div>
      </div>
      <div className="psa-ship-step__line" aria-hidden />
      <div className="psa-ship-step" role="listitem">
        <StepButton onClick={onLive && canGoLive ? onLive : undefined}>
          <div className="psa-ship-step__circle psa-ship-step__circle--idle">
            <span className="psa-ship-step__dot" />
          </div>
          <div className="psa-ship-step__label psa-ship-step__label--idle">Live</div>
        </StepButton>
      </div>
    </div>
  );
}
