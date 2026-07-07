"use client";

const STEPS = [
  { num: 1, label: "Ship to Vault" },
  { num: 2, label: "Confirm + Verify" },
  { num: 3, label: "Verify" },
  { num: 4, label: "Mint" },
] as const;

export function VaultStepper({ active = 1 }: { active?: number }) {
  return (
    <nav className="vault-stepper" aria-label="Vault submission progress">
      <div className="vault-stepper__track">
        {STEPS.map((step, index) => {
          const isActive = step.num === active;
          const isDone = step.num < active;
          const isLast = index === STEPS.length - 1;

          return (
            <div key={step.num} className="vault-stepper__item" style={{ flex: isLast ? 0 : 1 }}>
              <div className="vault-stepper__row">
                <div
                  className={`vault-stepper__dot ${
                    isActive
                      ? "vault-stepper__dot--active"
                      : isDone
                        ? "vault-stepper__dot--done"
                        : "vault-stepper__dot--upcoming"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isDone ? "✓" : step.num}
                </div>
                {!isLast ? (
                  <div
                    className={`vault-stepper__line ${
                      isDone
                        ? "vault-stepper__line--done"
                        : isActive
                          ? "vault-stepper__line--active"
                          : ""
                    }`}
                    aria-hidden
                  />
                ) : null}
              </div>
              <span
                className={`vault-stepper__label max-sm:hidden ${
                  isActive
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
