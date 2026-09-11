import Link from "next/link";
import { TkButton } from "@/components/ds";

const FEATURES = [
  {
    iconTone: "pos" as const,
    title: "Authentication",
    text: "Only PSA 9 & PSA 10 graded cards accepted. Each cert is verified against PSA's database.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    iconTone: "azure" as const,
    title: "Secure Vaulting",
    text: "Cards held in secure custody with intake verification. Each token backed by a specific, verified card.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    iconTone: "purple" as const,
    title: "On-chain Trading",
    text: "Cards stay vaulted while transactions settle atomically. No shipping, no chargebacks, no counterfeit risk.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12h4l3 8 4-16 3 8h4" />
      </svg>
    ),
  },
] as const;

const ICON_BG = {
  pos: { background: "rgba(0,200,100,0.12)", color: "var(--pos)" },
  azure: { background: "rgba(26,111,255,0.12)", color: "var(--azure)" },
  purple: { background: "rgba(111,75,255,0.14)", color: "#8f7bff" },
};

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
          <span>Trade the token.</span>
        </h1>
        <TkButton variant="primary" size="md" className="vault-landing__cta" onClick={onSignIn}>
          Connect wallet
        </TkButton>
        <div className="vault-landing__connect-hint">to start selling</div>
      </div>

      <div className="vault-landing__features">
        {FEATURES.map((f) => (
          <div key={f.title} className="vault-landing-feat">
            <div className="vault-landing-feat__icon" style={ICON_BG[f.iconTone]}>
              {f.icon}
            </div>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
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
