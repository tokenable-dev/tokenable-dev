import { Fragment } from "react";
import { cn } from "@/lib/ds/cn";

export type TkStepperTheme = "dark" | "light";
export type TkStepperOrientation = "horizontal" | "vertical";
export type TkStepperSize = "sm" | "md";
export type TkStepperStepState = "done" | "current" | "todo" | "rejected" | "failed";

export type TkStepperStep = {
  label: string;
  sub?: string;
  state: TkStepperStepState;
  onClick?: () => void;
};

export type TkStepperProps = {
  steps: TkStepperStep[];
  theme?: TkStepperTheme;
  orientation?: TkStepperOrientation;
  size?: TkStepperSize;
  className?: string;
  "aria-label"?: string;
};

function normalizeState(state: TkStepperStepState): "done" | "current" | "todo" | "failed" {
  if (state === "rejected" || state === "failed") return "failed";
  return state;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <polyline
        points="20 6 9 17 4 12"
        stroke="currentColor"
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}

function StepDot({
  state,
  index,
}: {
  state: ReturnType<typeof normalizeState>;
  index: number;
}) {
  const n = String(index + 1);
  if (state === "done") {
    return (
      <div className="tk-stepper__dot tk-stepper__dot--done">
        <CheckIcon />
      </div>
    );
  }
  if (state === "current") {
    return (
      <div className="tk-stepper__dot tk-stepper__dot--current">
        <span className="tk-stepper__num">{n}</span>
      </div>
    );
  }
  if (state === "failed") {
    return (
      <div className="tk-stepper__dot tk-stepper__dot--failed">
        <XIcon />
      </div>
    );
  }
  return (
    <div className="tk-stepper__dot tk-stepper__dot--todo">
      <span className="tk-stepper__num">{n}</span>
    </div>
  );
}

function connClass(prev: ReturnType<typeof normalizeState>, vertical: boolean): string {
  const base = vertical ? "tk-stepper__vconn" : "tk-stepper__conn";
  if (prev === "done") return `${base} ${base}--done`;
  if (prev === "current") return `${base} ${base}--current`;
  if (prev === "failed") return `${base} ${base}--failed`;
  return base;
}

export function TkStepper({
  steps,
  theme = "dark",
  orientation = "horizontal",
  size,
  className,
  "aria-label": ariaLabel = "Progress",
}: TkStepperProps) {
  const normalized = steps.map((s) => ({ ...s, state: normalizeState(s.state) }));
  const vertical = orientation === "vertical";

  return (
    <div
      className={cn(
        "tk-stepper",
        `tk-stepper--${theme}`,
        vertical ? "tk-stepper--vertical" : "tk-stepper--horizontal",
        size === "sm" && "tk-stepper--sm",
        size === "md" && "tk-stepper--md",
        className,
      )}
      role="list"
      aria-label={ariaLabel}
    >
      {vertical
        ? normalized.map((step, i) => {
            const last = i === normalized.length - 1;
            return (
              <div
                key={`${step.label}-${i}`}
                className={cn("tk-stepper__vstep", `tk-stepper__vstep--${step.state}`)}
                role="listitem"
              >
                <div className="tk-stepper__rail">
                  <StepDot state={step.state} index={i} />
                  {last ? null : <div className={connClass(step.state, true)} aria-hidden />}
                </div>
                <div className="tk-stepper__vcopy">
                  <div className="tk-stepper__vlabel">{step.label}</div>
                  {step.sub ? <div className="tk-stepper__vsub">{step.sub}</div> : null}
                </div>
              </div>
            );
          })
        : normalized.map((step, i) => (
            <Fragment key={`${step.label}-${i}`}>
              {i > 0 ? (
                <div className={connClass(normalized[i - 1]!.state, false)} aria-hidden />
              ) : null}
              {step.onClick ? (
                <button
                  type="button"
                  className={cn("tk-stepper__col", `tk-stepper__col--${step.state}`)}
                  role="listitem"
                  aria-current={step.state === "current" ? "step" : undefined}
                  onClick={step.onClick}
                >
                  <StepDot state={step.state} index={i} />
                  <div className="tk-stepper__label">{step.label}</div>
                  {step.sub ? <div className="tk-stepper__sub">{step.sub}</div> : null}
                </button>
              ) : (
                <div
                  className={cn("tk-stepper__col", `tk-stepper__col--${step.state}`)}
                  role="listitem"
                  aria-current={step.state === "current" ? "step" : undefined}
                >
                  <StepDot state={step.state} index={i} />
                  <div className="tk-stepper__label">{step.label}</div>
                  {step.sub ? <div className="tk-stepper__sub">{step.sub}</div> : null}
                </div>
              )}
            </Fragment>
          ))}
    </div>
  );
}
