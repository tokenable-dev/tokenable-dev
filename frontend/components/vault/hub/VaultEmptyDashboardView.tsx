import Link from "next/link";
import { TkButton } from "@/components/ds";

function VaultEmptyIcon() {
  return (
    <svg className="vault-empty-state__icon" width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden>
      <rect x="16" y="28" width="88" height="72" rx="8" stroke="rgba(26,111,255,0.35)" strokeWidth="2" fill="rgba(26,111,255,0.04)" />
      <rect x="30" y="38" width="60" height="52" rx="4" stroke="rgba(26,111,255,0.25)" strokeWidth="1.5" fill="none" />
      <circle cx="60" cy="64" r="16" stroke="rgba(26,111,255,0.5)" strokeWidth="2" fill="rgba(26,111,255,0.06)" />
      <circle cx="60" cy="64" r="6" stroke="rgba(26,111,255,0.4)" strokeWidth="1.5" fill="rgba(26,111,255,0.08)" />
      <line x1="60" y1="48" x2="60" y2="54" stroke="rgba(26,111,255,0.4)" strokeWidth="1.5" />
      <line x1="60" y1="74" x2="60" y2="80" stroke="rgba(26,111,255,0.4)" strokeWidth="1.5" />
      <line x1="44" y1="64" x2="50" y2="64" stroke="rgba(26,111,255,0.4)" strokeWidth="1.5" />
      <line x1="70" y1="64" x2="76" y2="64" stroke="rgba(26,111,255,0.4)" strokeWidth="1.5" />
      <rect x="16" y="42" width="4" height="8" rx="1" fill="rgba(26,111,255,0.2)" />
      <rect x="16" y="70" width="4" height="8" rx="1" fill="rgba(26,111,255,0.2)" />
      <rect x="20" y="100" width="16" height="6" rx="2" fill="rgba(26,111,255,0.15)" />
      <rect x="84" y="100" width="16" height="6" rx="2" fill="rgba(26,111,255,0.15)" />
      <circle cx="60" cy="64" r="28" fill="rgba(26,111,255,0.03)" />
    </svg>
  );
}

const HIW_STEPS = [
  {
    num: "01",
    title: "Submit",
    desc: "Enter your PSA certification number to verify your card",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--azure)" strokeWidth="1.5">
        <circle cx="11" cy="11" r="7" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Ship",
    desc: "Send your card to our secure vault facility",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--azure)" strokeWidth="1.5">
        <rect x="2" y="7" width="15" height="13" rx="2" />
        <path d="M17 11h3l2 3v4h-5" />
        <circle cx="7" cy="20" r="2" />
        <circle cx="19" cy="20" r="2" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Get Your Token",
    desc: "Receive your token automatically once your card is vaulted",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--azure)" strokeWidth="1.5">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
] as const;

export function VaultEmptyDashboardView() {
  return (
    <>
      <div className="vault-hub-stat-grid">
        <div className="vault-hub-stat-card vault-hub-stat-card--zero">
          <div className="vault-hub-stat-card__label">Total Assets</div>
          <div className="vault-hub-stat-card__num">0</div>
          <div className="vault-hub-stat-card__sub">Cards</div>
        </div>
        <div className="vault-hub-stat-card vault-hub-stat-card--zero">
          <div className="vault-hub-stat-card__label">In Progress</div>
          <div className="vault-hub-stat-card__num">0</div>
          <div className="vault-hub-stat-card__sub">Submissions</div>
        </div>
        <div className="vault-hub-stat-card vault-hub-stat-card--zero">
          <div className="vault-hub-stat-card__label">Minted Tokens</div>
          <div className="vault-hub-stat-card__num">0</div>
          <div className="vault-hub-stat-card__sub">Tokens</div>
        </div>
      </div>

      <div className="vault-empty-state">
        <VaultEmptyIcon />
        <h2 className="vault-empty-state__title">No cards in your vault yet</h2>
        <p className="vault-empty-state__sub">
          Submit your first PSA 9 or PSA 10 graded card to get started. Your card will be tokenized and secured in our vault.
        </p>
        <div className="vault-empty-state__actions">
          <Link href="/vault/submit" className="inline-flex">
            <TkButton decorative variant="primary" size="md" className="h-[54px] px-8 text-[15px]">
              + Submit Your First Card →
            </TkButton>
          </Link>
        </div>
      </div>

      <div className="vault-hiw">
        <div className="vault-hiw__title">How it works</div>
        <div className="vault-hiw__grid">
          <div className="vault-hiw__connector vault-hiw__connector--1" aria-hidden />
          <div className="vault-hiw__connector vault-hiw__connector--2" aria-hidden />
          {HIW_STEPS.map((step) => (
            <div key={step.num} className="vault-hiw__step">
              <div className="vault-hiw__step-icon">{step.icon}</div>
              <div className="vault-hiw__num">{step.num}</div>
              <div className="vault-hiw__step-title">{step.title}</div>
              <div className="vault-hiw__step-desc">{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
