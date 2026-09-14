import Link from "next/link";
import { TkButton } from "@/components/ds";

const LANDING_STEPS = [
  {
    tone: "blue" as const,
    n: "1",
    title: "Ship your PSA & BGS 10s to our vault",
    text: "Send your graded cards to our secure, insured vault.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" shapeRendering="crispEdges" strokeLinecap="square">
        <path d="M12 16V5" />
        <path d="M7 10l5-5 5 5" />
        <rect x="4" y="18" width="16" height="3" />
      </svg>
    ),
  },
  {
    tone: "blue" as const,
    n: "2",
    title: "We mint a token to your wallet",
    text: "A token backed by your exact, verified card lands on-chain.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" shapeRendering="crispEdges" strokeLinecap="square">
        <rect x="4" y="4" width="16" height="16" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    ),
  },
  {
    tone: "blue" as const,
    n: "3",
    title: "Sell your token on Tokenable",
    text: "List it or accept a bid — the card never leaves the vault.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" shapeRendering="crispEdges" strokeLinecap="square">
        <path d="M4 4h9l7 7-9 9-7-7z" />
        <rect x="7" y="7" width="3" height="3" />
      </svg>
    ),
  },
  {
    tone: "green" as const,
    n: "4",
    title: "You get paid instantly",
    text: "Settlement is on-chain and immediate. No shipping, no waiting.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.6" shapeRendering="crispEdges" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M13 3L5 13h6l-1 8 8-10h-6z" />
      </svg>
    ),
  },
] as const;

function LandingDots({ tone }: { tone: "blue" | "green" }) {
  return (
    <div className={`vault-landing-dots vault-landing-dots--${tone}`} aria-hidden>
      <span />
      <span />
      <span />
    </div>
  );
}

/** Signed-out sell hub landing — Vault-Dashboard-Active.html `#view-landing`. */
export function VaultLandingView({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="vault-landing">
      <div className="vault-landing__hero">
        <div className="vault-landing__icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--azure)" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1>
          Vault your cards.
          <br />
          <span>Sell the token.</span>
        </h1>
      </div>

      <ol className="vault-landing__steps">
        {LANDING_STEPS.map((step, i) => (
          <li key={step.n}>
            <div className={`vault-landing-step vault-landing-step--${step.tone}`}>
              <div className="vault-landing-step__icon">
                {step.icon}
                <span className="vault-landing-step__num">{step.n}</span>
              </div>
              <div className="vault-landing-step__copy">
                <div className="vault-landing-step__title">{step.title}</div>
                <p>{step.text}</p>
              </div>
            </div>
            {i < LANDING_STEPS.length - 1 ? (
              <LandingDots tone={i === LANDING_STEPS.length - 2 ? "green" : "blue"} />
            ) : null}
          </li>
        ))}
      </ol>

      <div className="vault-landing__cta-wrap">
        <TkButton variant="primary" size="md" className="vault-landing__cta" onClick={onSignIn}>
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
