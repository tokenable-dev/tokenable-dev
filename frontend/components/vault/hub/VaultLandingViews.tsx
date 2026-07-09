import Link from "next/link";
import { TkButton } from "@/components/ds";

const FEATURES = [
  {
    iconTone: "pos" as const,
    title: "Authentication",
    text: "Only PSA 9 & PSA 10 graded cards accepted. Each cert is verified against PSA's database.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 12l2 2 4-4" />
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      </svg>
    ),
  },
  {
    iconTone: "azure" as const,
    title: "Secure Vaulting",
    text: "Cards held in insured custody with intake verification. Each token backed by a specific, verified card.",
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
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
] as const;

const ICON_BG = {
  pos: { background: "rgba(0,200,100,0.08)", color: "var(--pos)" },
  azure: { background: "rgba(26,111,255,0.08)", color: "var(--azure)" },
  purple: { background: "rgba(139,92,246,0.08)", color: "#8b5cf6" },
};

export function VaultLandingView({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="vault-landing">
      <div className="vault-landing__icon">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--azure)" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          <circle cx="12" cy="16" r="1" />
        </svg>
      </div>
      <h1>
        Vault your cards.
        <br />
        <span>Own the token.</span>
      </h1>
      <p className="vault-landing__text">
        Submit your PSA-graded cards to our secure vault.
        <br />
        We verify, insure, and mint your token — so you can trade without shipping.
      </p>
      <TkButton variant="primary" size="md" className="h-14 px-9 text-base" onClick={onSignIn}>
        Connect Wallet to Start →
      </TkButton>

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
      <p>Submit your first PSA graded card to get started. We&apos;ll verify, vault, and mint your token.</p>
      <Link href="/vault/submit" className="inline-flex">
        <TkButton decorative variant="primary" size="md" className="h-[52px] px-7 text-[15px]">
          + Submit Your First Card →
        </TkButton>
      </Link>
    </div>
  );
}
