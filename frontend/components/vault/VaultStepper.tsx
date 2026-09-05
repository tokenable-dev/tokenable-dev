"use client";

import Link from "next/link";
import { TkStepper } from "@/components/ds";
import { cn } from "@/lib/ds/cn";
import {
  buildSimpleVaultSteps,
  toTkStepperState,
  type VaultStepDef,
} from "@/lib/vault/vaultStepSpec";

function StepExtras({ step }: { step: VaultStepDef }) {
  if (!step.detail && !step.cta) return null;
  return (
    <div className="vault-stepper__detail-block">
      {step.detail ? (
        <div className="vault-stepper__detail">
          {typeof step.detail === "string" ? (
            step.detail
          ) : (
            <a href={step.detail.href} target="_blank" rel="noopener noreferrer">
              {step.detail.text}
            </a>
          )}
        </div>
      ) : null}
      {step.cta ? (
        <Link
          href={step.cta.href}
          className={cn("vault-stepper__cta", step.state === "action" && "vault-stepper__cta--action")}
        >
          {step.cta.label}
        </Link>
      ) : null}
    </div>
  );
}

export function VaultStepper({
  active,
  steps,
  variant = "default",
  size = "md",
}: {
  active?: number;
  steps?: VaultStepDef[];
  variant?: "default" | "rejected";
  rich?: boolean;
  compact?: boolean;
  size?: "sm" | "md";
}) {
  const resolvedSteps =
    variant === "rejected"
      ? [
          { label: "Submit", state: "failed" as const, sub: "Ineligible" },
          { label: "Ship", state: "inactive" as const },
          { label: "Vault", state: "inactive" as const },
          { label: "Mint", state: "inactive" as const },
        ]
      : (steps ?? (active != null ? buildSimpleVaultSteps(active) : buildSimpleVaultSteps(1)));

  const extras = resolvedSteps.filter((s) => s.detail || s.cta);

  return (
    <div className="vault-stepper-wrap vault-stepper-wrap--ds">
      <TkStepper
        theme="dark"
        size={size}
        aria-label="Vault submission progress"
        steps={resolvedSteps.map((s) => ({
          label: s.label,
          sub: s.sub,
          state: toTkStepperState(s.state),
        }))}
      />
      {extras.map((step, i) => (
        <StepExtras key={`${step.label}-${i}`} step={step} />
      ))}
    </div>
  );
}
