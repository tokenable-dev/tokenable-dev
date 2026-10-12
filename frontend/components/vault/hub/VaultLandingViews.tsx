import Link from "next/link";
import { TkButton } from "@/components/ds";

const LANDING_STEPS = [
  {
    n: 1,
    tone: "azure" as const,
    line: "azure" as const,
    title: "Ship your PSA & BGS 10s to our vault",
  },
  {
    n: 2,
    tone: "azure" as const,
    line: "pos" as const,
    title: "We mint a token to your wallet",
  },
  {
    n: 3,
    tone: "pos" as const,
    line: null,
    title: "List and sell your token",
  },
] as const;

/** Signed-out sell hub landing — Vault-Dashboard-Active.html `#view-landing`. */
export function VaultLandingView({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="vault-landing">
      <div className="vault-landing__hero">
        <div className="vault-landing__hero-art">
          <img src="/images/vault-landing-hero.png" alt="" width={150} height={150} />
        </div>
        <h1>Sell your cards.</h1>
      </div>

      <div className="vault-landing__flow">
        {LANDING_STEPS.map((step) => (
          <div key={step.n} className="vault-landing-flow-row">
            <div className="vault-landing-flow-row__rail">
              <span
                className={
                  step.tone === "pos"
                    ? "vault-landing-flow-row__num vault-landing-flow-row__num--pos"
                    : "vault-landing-flow-row__num"
                }
                aria-hidden
              >
                {step.n}
              </span>
              {step.line ? (
                <div
                  className={
                    step.line === "pos"
                      ? "vault-landing-flow-row__line vault-landing-flow-row__line--pos"
                      : "vault-landing-flow-row__line"
                  }
                  aria-hidden
                />
              ) : null}
            </div>
            <div className="vault-landing-flow-row__copy">
              <div className="vault-landing-flow-row__title">{step.title}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="vault-landing__cta-wrap">
        <TkButton
          variant="primary"
          size="md"
          className="vault-landing__cta tk-connect"
          onClick={onSignIn}
        >
          Connect wallet
        </TkButton>
        <div className="vault-landing__connect-hint">to start selling</div>
      </div>
    </div>
  );
}

export function VaultEmptyView() {
  return (
    <div className="vault-empty">
      <div className="vault-empty__icon">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          <circle cx="12" cy="16" r="1" />
        </svg>
      </div>
      <h2>No cards in your vault yet</h2>
      <p>
        Submit your first PSA 9 or PSA 10 graded card to get started. Your card will be tokenized and
        secured in our vault.
      </p>
      <Link href="/sell/flow" className="inline-flex">
        <TkButton decorative variant="primary" size="md" className="h-[52px] px-7 text-[15px]">
          + Submit Your First Card →
        </TkButton>
      </Link>
    </div>
  );
}
