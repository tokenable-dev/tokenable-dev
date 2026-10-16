"use client";

import { Fragment } from "react";
import Link from "next/link";
import { TkStepper } from "@/components/ds";
import { cn } from "@/lib/ds/cn";
import {
  buildSimpleVaultSteps,
  subColorCss,
  toTkStepperState,
  type VaultStepDef,
  type VaultStepState,
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

function RichStepDot({ state }: { state: VaultStepState }) {
  if (state === "done") {
    return (
      <div className="vault-stepper__dot vault-stepper__dot--done">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  if (state === "active") {
    return (
      <div className="vault-stepper__dot vault-stepper__dot--active">
        <span className="vault-stepper__active-core" aria-hidden />
      </div>
    );
  }
  if (state === "failed") {
    return (
      <div className="vault-stepper__dot vault-stepper__dot--failed">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </div>
    );
  }
  if (state === "action") {
    return <div className="vault-stepper__dot vault-stepper__dot--action">!</div>;
  }
  return <div className="vault-stepper__dot vault-stepper__dot--upcoming" />;
}

function richLabelClass(state: VaultStepState): string {
  if (state === "done") return "vault-stepper__label vault-stepper__label--done";
  if (state === "active" || state === "action") return "vault-stepper__label vault-stepper__label--active";
  if (state === "failed") return "vault-stepper__label vault-stepper__label--failed";
  return "vault-stepper__label vault-stepper__label--muted";
}

function richConnectorClass(prev: VaultStepState): string {
  if (prev === "done") return "vault-stepper__line vault-stepper__line--done";
  if (prev === "active") return "vault-stepper__line vault-stepper__line--gradient";
  if (prev === "failed") return "vault-stepper__line vault-stepper__line--failed";
  return "vault-stepper__line";
}

/** Vault-Detail.html `stepBar` — circle stepper with subs (Submit / Ship / PSA / Live). */
function RichVaultStepper({ steps }: { steps: VaultStepDef[] }) {
  const extras = steps.filter((s) => s.detail || s.cta);
  const hasCta = steps.some((s) => s.cta);

  return (
    <div className={cn("vault-stepper-wrap vault-stepper-wrap--rich", hasCta && "vault-stepper-wrap--rich-cta")}>
      <div className="vault-stepper vault-stepper--rich" role="list" aria-label="Vault submission progress">
        {steps.map((step, i) => (
          <Fragment key={`${step.label}-${i}`}>
            {i > 0 ? (
              <div className={richConnectorClass(steps[i - 1]!.state)} aria-hidden />
            ) : null}
            <div className="vault-stepper__item" role="listitem">
              <RichStepDot state={step.state} />
              <div className="vault-stepper__labels">
                <div className={richLabelClass(step.state)}>{step.label}</div>
                {step.sub ? (
                  <div
                    className="vault-stepper__sub"
                    style={{ color: subColorCss(step.subColor) }}
                  >
                    {step.spin ? <span className="vault-stepper__spin" aria-hidden /> : null}
                    {step.sub}
                  </div>
                ) : null}
              </div>
            </div>
          </Fragment>
        ))}
      </div>
      {extras.map((step, i) => (
        <StepExtras key={`${step.label}-extra-${i}`} step={step} />
      ))}
    </div>
  );
}

export function VaultStepper({
  active,
  steps,
  variant = "default",
  rich = false,
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

  if (rich) {
    return <RichVaultStepper steps={resolvedSteps} />;
  }

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
