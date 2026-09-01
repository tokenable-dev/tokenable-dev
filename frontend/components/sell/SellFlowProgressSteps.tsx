"use client";

import { TkStepper, type TkStepperStep, type TkStepperStepState } from "@/components/ds";

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

function phaseState(
  phase: SellProgressPhase,
  key: SellProgressPhase,
  submitDone: boolean,
): TkStepperStepState {
  const order: SellProgressPhase[] = ["submit", "ship", "psa", "live"];
  const i = order.indexOf(key);
  const cur = order.indexOf(phase);
  if (key === "submit" && (submitDone || cur > 0)) return "done";
  if (i < cur) return "done";
  if (i === cur) return "current";
  return "todo";
}

/** Submit → Ship → PSA → Live — TkStepper (clickable when reachable). */
export function SellFlowProgressSteps({
  phase,
  shipInTransit: _shipInTransit = false,
  shipSublabel,
  submitDone = false,
  canGoSubmit = false,
  canGoShip = false,
  canGoLive = false,
  onSubmit,
  onShip,
  onLive,
}: Props) {
  const steps: TkStepperStep[] = [
    {
      label: "Submit",
      state: phaseState(phase, "submit", submitDone),
      onClick: onSubmit && canGoSubmit ? onSubmit : undefined,
    },
    {
      label: "Ship",
      sub: shipSublabel,
      state: phaseState(phase, "ship", submitDone),
      onClick: onShip && canGoShip ? onShip : undefined,
    },
    {
      label: "PSA",
      state: phaseState(phase, "psa", submitDone),
    },
    {
      label: "Live",
      state: phaseState(phase, "live", submitDone),
      onClick: onLive && canGoLive ? onLive : undefined,
    },
  ];

  return (
    <div className="sell-ship-steps">
      <TkStepper theme="light" size="md" aria-label="Progress" steps={steps} />
    </div>
  );
}
