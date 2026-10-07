"use client";

import { TkStepper, type TkStepperStepState } from "@/components/ds";
import type { ListRwaModalStep } from "@/lib/seaport/listing/listRwaModalTypes";

const LIST_FLOW_STEPS = ["Approve", "Sign", "Submit"] as const;

function listFlowActiveIndex(step: ListRwaModalStep): number {
  if (step === "approving") return 0;
  if (step === "signing") return 1;
  if (step === "submitting" || step === "matching") return 2;
  return -1;
}

function listFlowStepState(step: ListRwaModalStep, index: number): TkStepperStepState {
  const active = listFlowActiveIndex(step);
  if (active < 0) return "todo";
  if (index < active) return "done";
  if (index === active) return "current";
  return "todo";
}

/** Approve → Sign → Submit — TkStepper. */
export function ListingFlowProgress({ step }: { step: ListRwaModalStep }) {
  const busy =
    step === "approving" ||
    step === "signing" ||
    step === "submitting" ||
    step === "matching";

  return (
    <TkStepper
      theme="dark"
      aria-label="Listing progress"
      className={busy ? "tk-stepper--listing-busy" : undefined}
      steps={LIST_FLOW_STEPS.map((title, i) => ({
        label: title,
        state: listFlowStepState(step, i),
      }))}
    />
  );
}
