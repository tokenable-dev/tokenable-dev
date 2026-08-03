"use client";

import type { ReactNode } from "react";

/** PSA-Shipping.html step rail: Submit → Ship → PSA → Live */
export type SellProgressPhase = "submit" | "ship" | "psa" | "live";

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
  phase: SellProgressPhase;
  /** Ship circle shows transit spinner after tracking is confirmed. */
  shipInTransit?: boolean;
  shipSublabel?: string;
  /** Submit step is complete (user has left add-cards for shipping). */
  submitDone?: boolean;
  canGoSubmit?: boolean;
  canGoShip?: boolean;
  canGoLive?: boolean;
  onSubmit?: () => void;
  onShip?: () => void;
  onLive?: () => void;
};

/** Submit → Ship → PSA → Live (PSA-Shipping.html). Clickable when reachable. */
export function SellFlowProgressSteps({
  phase,
  shipInTransit = false,
  shipSublabel,
  submitDone = false,
  canGoSubmit = false,
  canGoShip = false,
  canGoLive = false,
  onSubmit,
  onShip,
  onLive,
}: Props) {
  const submitState: StepState =
    phase === "submit" && !submitDone ? "active" : submitDone || phase !== "submit" ? "done" : "inactive";

  const shipState: StepState =
    phase === "ship"
      ? shipInTransit
        ? "transit"
        : "active"
      : phase === "psa" || phase === "live"
        ? "done"
        : "inactive";

  const psaState: StepState =
    phase === "psa" ? "active" : phase === "live" ? "done" : "inactive";

  const liveState: StepState = phase === "live" ? "active" : "inactive";

  const submitClickable = Boolean(onSubmit) && canGoSubmit;
  const shipClickable = Boolean(onShip) && canGoShip;
  const liveClickable = Boolean(onLive) && canGoLive;

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
        state={psaState}
        label="PSA"
        labelTone={phase === "psa" ? "on" : psaState === "done" ? "pos" : "muted"}
        number="3"
      />
      <div
        className={`sell-ship-connector${
          psaState === "done" ? " sell-ship-connector--pos" : ""
        }`}
      />
      <ProgressStep
        state={liveState}
        label="Live"
        labelTone={phase === "live" ? "on" : "muted"}
        number="4"
        onClick={onLive}
        disabled={!liveClickable}
      />
    </div>
  );
}
