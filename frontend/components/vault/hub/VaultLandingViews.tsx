import Link from "next/link";
import { TkButton } from "@/components/ds";

const LANDING_STEPS = [
  { tone: "azure" as const, title: "Ship your PSA & BGS 10s to our vault" },
  { tone: "azure" as const, title: "We mint a token to your wallet" },
  { tone: "pos" as const, title: "List and sell your token" },
] as const;

/** Signed-out sell hub landing — Vault-Dashboard-Active.html `#view-landing`. */
export function VaultLandingView({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="vault-landing">
      <div className="vault-landing__hero">
        <h1>Sell your cards.</h1>
      </div>

      <ol className="vault-landing__steps">
        {LANDING_STEPS.map((step) => (
          <li key={step.title} className="vault-landing-step">
            <span
              className={`vault-landing-step__bullet vault-landing-step__bullet--${step.tone}`}
              aria-hidden
            />
            <div className="vault-landing-step__title">{step.title}</div>
          </li>
        ))}
      </ol>

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
