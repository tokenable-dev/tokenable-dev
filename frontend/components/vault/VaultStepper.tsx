"use client";

function StepCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function VaultStepper({
  active = 1,
  variant = "default",
}: {
  active?: number;
  variant?: "default" | "rejected";
}) {
  const isRejected = variant === "rejected";

  return (
    <nav className={`vault-stepper${isRejected ? " vault-stepper--rejected" : ""}`} aria-label="Vault submission progress">
      <div className="vault-stepper__track">
        {[
          { num: 1, label: "Submit" },
          { num: 2, label: "Ship" },
          { num: 3, label: "Vault" },
          { num: 4, label: "Mint" },
        ].map((step, index) => {
          const isActive = !isRejected && step.num === active;
          const isDone = !isRejected && step.num < active;
          const isLast = index === 3;
          const lineDone = isRejected ? false : isDone;
          const lineGradient = !isRejected && isActive && step.num === 4;

          return (
            <div key={step.num} className="vault-stepper__item" style={{ flex: isLast ? 0 : 1 }}>
              <div className="vault-stepper__row">
                <div
                  className={`vault-stepper__dot ${
                    isRejected
                      ? step.num === 1
                        ? "vault-stepper__dot--halted"
                        : "vault-stepper__dot--upcoming"
                      : isActive
                        ? "vault-stepper__dot--active"
                        : isDone
                          ? "vault-stepper__dot--done"
                          : "vault-stepper__dot--upcoming"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isRejected ? (step.num === 1 ? "—" : step.num) : isDone ? <StepCheckIcon /> : step.num}
                </div>
                {!isLast ? (
                  <div
                    className={`vault-stepper__line ${
                      lineGradient
                        ? "vault-stepper__line--gradient"
                        : lineDone
                          ? "vault-stepper__line--done"
                          : ""
                    }`}
                    aria-hidden
                  />
                ) : null}
              </div>
              <span
                className={`vault-stepper__label ${
                  isRejected
                    ? "vault-stepper__label--muted"
                    : isActive
                      ? "vault-stepper__label--active"
                      : isDone
                        ? "vault-stepper__label--done"
                        : ""
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
