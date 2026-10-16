"use client";

import type { AuthUser } from "@/lib/auth";
import { SettingsBtn } from "./SettingsBtn";

const AGREEMENTS: { title: string; href: string }[] = [
  { title: "Seller Agreement", href: "https://tokenable.io/terms" },
  { title: "Terms of Use", href: "https://tokenable.io/terms" },
  { title: "Privacy Policy", href: "https://tokenable.io/privacy" },
];

const CONSENT_LABELS = [
  "Seller Agreement & Terms of Use",
  "PSA Vault storage & withdrawal terms",
  "5% platform fee on completed sales",
] as const;

function formatConsentDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SettingsLegalSection({ user }: { user: AuthUser }) {
  const acceptedOn = formatConsentDate(user.kycVerifiedAt);

  return (
    <section className="tk-settings__sec tk-settings__sec--legal">
      <h1 className="tk-settings__sec-h">Legal &amp; consents</h1>
      <p className="tk-settings__sec-sub">
        Manage your agreements and communication preferences.
      </p>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl" style={{ marginBottom: 4 }}>
          Agreements
        </div>
        {AGREEMENTS.map((item) => (
          <div key={item.title} className="tk-settings__row">
            <div className="tk-settings__row-t">{item.title}</div>
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="tk-settings__btn tk-settings__btn--ghost tk-settings__btn--sm"
            >
              View
            </a>
          </div>
        ))}
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl" style={{ marginBottom: 12 }}>
          Consent history
        </div>
        {acceptedOn ? (
          <div className="flex flex-col gap-3">
            {CONSENT_LABELS.map((label) => (
              <div key={label} className="flex gap-2.5">
                <span className="shrink-0 text-[var(--pos)]" aria-hidden>✓</span>
                <span className="text-[13px] leading-relaxed text-[var(--t2)]">
                  {label}{" "}
                  <span className="font-sans text-[var(--t3)]">· accepted {acceptedOn}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] leading-relaxed text-[var(--t2)]">
            Seller and vault consents are recorded when you verify identity and complete
            your first listing in the sell flow.
          </p>
        )}
      </div>
    </section>
  );
}
