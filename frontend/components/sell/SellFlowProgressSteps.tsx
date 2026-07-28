"use client";

import type { ReactNode } from "react";

export type SellProgressPhase = "submit" | "ship" | "portfolio";

type StepState = "done" | "active" | "inactive" | "transit";

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function StepCircle({ state, children }: { state: StepState; children?: ReactNode }) {
  return (
    <div className={`sell-ship-circle sell-ship-circle--${state}`}>
      {state === "done" ? <CheckIcon /> : null}
      {state === "transit" ? <span className="sell-ship-spin" aria-hidden /> : null}
      {state === "active" || state === "inactive" ? children : null}
    </div>
  );
}

type StepProps = {
  state: StepState;
  label: string;
  labelTone?: "pos" | "on" | "muted";
  sublabel?: string;
  number?: string;
  onClick?: () => void;
  disabled?: boolean;
};

function ProgressStep({
  state,
  label,
  labelTone = "muted",
  sublabel,
  number,
  onClick,
  disabled,
}: StepProps) {
  const clickable = Boolean(onClick) && !disabled;
  const labelClass =
    labelTone === "pos"
      ? "sell-ship-step__label sell-ship-step__label--pos"
      : labelTone === "on"
        ? "sell-ship-step__label sell-ship-step__label--on"
        : "sell-ship-step__label";

  const inner = (
    <>
      <StepCircle state={state}>{number}</StepCircle>
      <div className={labelClass}>{label}</div>
      {sublabel ? (
        <div
          className={`sell-ship-step__sub${labelTone === "muted" ? " sell-ship-step__sub--muted" : ""}`}
        >
          {sublabel}
        </div>
      ) : null}
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        className="sell-ship-step sell-ship-step--btn"
        onClick={onClick}
        aria-current={state === "active" ? "step" : undefined}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={`sell-ship-step${disabled && onClick ? " sell-ship-step--disabled" : ""}`}
      aria-current={state === "active" ? "step" : undefined}
    >
      {inner}
    </div>
  );
}

type Props = {
  /** Which of the three top-level phases is current. */
  phase: SellProgressPhase;
  /** Ship circle shows transit spinner after tracking is confirmed. */
  shipInTransit?: boolean;
  shipSublabel?: string;
  portfolioSublabel?: string;
  /** Submit step is complete (user has left add-cards for shipping). */
  submitDone?: boolean;
  canGoSubmit?: boolean;
  canGoShip?: boolean;
  canGoPortfolio?: boolean;
  onSubmit?: () => void;
  onShip?: () => void;
  onPortfolio?: () => void;
};

/** Submit → Ship → Portfolio indicator. Clickable when the target step is reachable. */
export function SellFlowProgressSteps({
  phase,
  shipInTransit = false,
  shipSublabel,
  portfolioSublabel = "After PSA review",
  submitDone = false,
  canGoSubmit = false,
  canGoShip = false,
  canGoPortfolio = false,
  onSubmit,
  onShip,
  onPortfolio,
}: Props) {
  const submitState: StepState =
    phase === "submit" && !submitDone ? "active" : submitDone || phase !== "submit" ? "done" : "inactive";
  const shipState: StepState =
    phase === "ship"
      ? shipInTransit
        ? "transit"
        : "active"
      : phase === "portfolio"
        ? "done"
        : "inactive";
  const portfolioState: StepState = phase === "portfolio" ? "active" : "inactive";

  const submitClickable = Boolean(onSubmit) && canGoSubmit;
  const shipClickable = Boolean(onShip) && canGoShip;
  const portfolioClickable = Boolean(onPortfolio) && canGoPortfolio;

  return (
    <div className="sell-ship-steps" aria-label="Progress">
      <ProgressStep
        state={submitState}
        label="Submit"
        labelTone={submitState === "done" ? "pos" : phase === "submit" ? "on" : "muted"}
        number="1"
        onClick={onSubmit}
        disabled={!submitClickable}
      />
      <div
        className={`sell-ship-connector${
          submitState === "done" ? " sell-ship-connector--pos" : ""
        }`}
      />
      <ProgressStep
        state={shipState}
        label="Ship"
        labelTone={phase === "ship" ? "on" : shipState === "done" ? "pos" : "muted"}
        sublabel={shipSublabel}
        number="2"
        onClick={onShip}
        disabled={!shipClickable}
      />
      <div
        className={`sell-ship-connector${
          shipState === "done" ? " sell-ship-connector--pos" : ""
        }`}
      />
      <ProgressStep
        state={portfolioState}
        label="Portfolio"
        labelTone={phase === "portfolio" ? "on" : "muted"}
        sublabel={portfolioSublabel}
        number="3"
        onClick={onPortfolio}
        disabled={!portfolioClickable}
      />
    </div>
  );
}
