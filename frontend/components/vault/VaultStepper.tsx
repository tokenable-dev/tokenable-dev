"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { useIsMobileViewport } from "@/hooks/ui/useIsMobileViewport";
import { cn } from "@/lib/ds/cn";
import {
  buildSimpleVaultSteps,
  subColorCss,
  type VaultStepDef,
  type VaultStepState,
} from "@/lib/vault/vaultStepSpec";

function StepCheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function StepXIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function StepSpinner() {
  return <span className="vault-stepper__spin" aria-hidden />;
}

function labelColor(state: VaultStepState): string {
  if (state === "done") return "var(--pos)";
  if (state === "active") return "#fff";
  if (state === "action") return "var(--amber)";
  if (state === "failed") return "var(--neg)";
  return "rgba(255,255,255,0.35)";
}

function connectorStyle(
  fromState: VaultStepState,
  rich: boolean,
): { background: string; gradient?: boolean } {
  if (fromState === "done") return { background: "var(--pos)" };
  if (fromState === "active") {
    // Detail (rich): gradient into next step. Submit/Ship (simple): muted line.
    if (rich) {
      return { background: "linear-gradient(90deg, var(--pos), var(--azure))", gradient: true };
    }
    return { background: "rgba(255,255,255,0.06)" };
  }
  if (fromState === "failed") return { background: "var(--neg)" };
  return { background: "rgba(255,255,255,0.1)" };
}

function VaultStepDot({
  step,
  index,
  isRejected,
  rich,
}: {
  step: VaultStepDef;
  index: number;
  isRejected?: boolean;
  rich?: boolean;
}) {
  const { state, spin } = step;

  if (isRejected) {
    return (
      <div
        className={cn(
          "vault-stepper__dot",
          index === 0 ? "vault-stepper__dot--halted" : "vault-stepper__dot--upcoming",
        )}
      >
        {index === 0 ? "—" : index + 1}
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="vault-stepper__dot vault-stepper__dot--done">
        <StepCheckIcon />
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="vault-stepper__dot vault-stepper__dot--failed">
        <StepXIcon />
      </div>
    );
  }

  if (state === "action") {
    return <div className="vault-stepper__dot vault-stepper__dot--action">!</div>;
  }

  if (state === "active") {
    return (
      <div className="vault-stepper__dot vault-stepper__dot--active">
        {spin || rich ? <StepSpinner /> : index + 1}
      </div>
    );
  }

  if (state === "inactive") {
    return <div className="vault-stepper__dot vault-stepper__dot--upcoming">{index + 1}</div>;
  }

  return <div className="vault-stepper__dot vault-stepper__dot--pending" aria-hidden />;
}

function StepDetailContent({ step }: { step: VaultStepDef }) {
  if (!step.detail && !step.cta) return null;
  return (
    <>
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
    </>
  );
}

export function VaultStepper({
  active,
  steps,
  variant = "default",
  rich = false,
  compact = false,
}: {
  active?: number;
  steps?: VaultStepDef[];
  variant?: "default" | "rejected";
  rich?: boolean;
  /** Compact mobile labels — Detail HTML always shows all 4; opt-in only */
  compact?: boolean;
}) {
  const isRejected = variant === "rejected";
  const resolvedSteps = steps ?? (active != null ? buildSimpleVaultSteps(active) : buildSimpleVaultSteps(1));
  const isRich = rich;
  const isNarrow = useIsMobileViewport(640);
  const isCompact = compact && isNarrow && isRich;

  const activeStep = useMemo(
    () =>
      resolvedSteps.find((s) => s.state === "active" || s.state === "action" || s.state === "failed") ??
      resolvedSteps[0],
    [resolvedSteps],
  );

  const hasStepCta = resolvedSteps.some((s) => s.cta);

  return (
    <div className={cn("vault-stepper-wrap", isCompact && "vault-stepper-wrap--compact", isRich && "vault-stepper-wrap--rich")}>
      <nav
        className={cn(
          "vault-stepper",
          isRich && "vault-stepper--rich",
          isRich && hasStepCta && "vault-stepper--rich-cta",
          isCompact && "vault-stepper--compact",
          isRejected && "vault-stepper--rejected",
        )}
        aria-label="Vault submission progress"
      >
        {resolvedSteps.map((step, index) => {
          const isLast = index === resolvedSteps.length - 1;
          const lineFromState = step.state;
          const connector = connectorStyle(lineFromState, isRich);
          const lineDone = lineFromState === "done";
          const isCurrent = step.state === "active" || step.state === "action" || step.state === "failed";
          const hideLabels = isCompact && !isCurrent;
          const labelCls = cn(
            "vault-stepper__label",
            step.state === "active" && "vault-stepper__label--active",
            step.state === "done" && "vault-stepper__label--done",
            (step.state === "pending" || step.state === "inactive") && "vault-stepper__label--muted",
            step.state === "failed" && "vault-stepper__label--failed",
            hideLabels && "vault-stepper__label--hidden",
          );

          return (
            <Fragment key={`${step.label}-${index}`}>
              <div
                className={cn("vault-stepper__item", step.state === "active" && "vault-stepper__item--active")}
              >
                <VaultStepDot step={step} index={index} isRejected={isRejected} rich={isRich} />
                <div className={cn("vault-stepper__labels", hideLabels && "vault-stepper__labels--hidden")}>
                  <div className={labelCls} style={isRich ? { color: labelColor(step.state) } : undefined}>
                    {step.label}
                  </div>
                  {step.sub && !hideLabels ? (
                    <div className="vault-stepper__sub" style={{ color: subColorCss(step.subColor) }}>
                      {step.sub}
                    </div>
                  ) : null}
                  {!isCompact ? <StepDetailContent step={step} /> : null}
                </div>
              </div>
              {!isLast ? (
                <div
                  className={cn(
                    "vault-stepper__line",
                    lineDone && "vault-stepper__line--done",
                    connector.gradient && "vault-stepper__line--gradient",
                  )}
                  style={{ background: connector.background }}
                  aria-hidden
                />
              ) : null}
            </Fragment>
          );
        })}
      </nav>

      {isCompact && activeStep ? (
        <div className="vault-stepper__compact-detail">
          {activeStep.sub ? (
            <div className="vault-stepper__compact-sub" style={{ color: subColorCss(activeStep.subColor) }}>
              {activeStep.sub}
            </div>
          ) : null}
          <StepDetailContent step={activeStep} />
        </div>
      ) : null}
    </div>
  );
}
