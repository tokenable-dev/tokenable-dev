"use client";

import { useLocale, useTranslations } from "next-intl";
import type { AuthUser } from "@/lib/auth";
import { SettingsBtn } from "./SettingsBtn";

const AGREEMENTS: { key: "sellerAgreement" | "terms" | "privacy"; href: string }[] = [
  { key: "sellerAgreement", href: "https://tokenable.io/terms" },
  { key: "terms", href: "https://tokenable.io/terms" },
  { key: "privacy", href: "https://tokenable.io/privacy" },
];

const CONSENT_KEYS = ["consentSeller", "consentVault", "consentFee"] as const;

function formatConsentDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SettingsLegalSection({ user }: { user: AuthUser }) {
  const t = useTranslations("Settings");
  const locale = useLocale();
  const acceptedOn = formatConsentDate(user.kycVerifiedAt, locale);

  return (
    <section className="tk-settings__sec tk-settings__sec--legal">
      <h1 className="tk-settings__sec-h">{t("nav.legal")}</h1>
      <p className="tk-settings__sec-sub">
        {t("ui.legalSub")}
      </p>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl" style={{ marginBottom: 4 }}>
          {t("ui.agreements")}
        </div>
        {AGREEMENTS.map((item) => (
          <div key={item.key} className="tk-settings__row">
            <div className="tk-settings__row-t">{t(`ui.${item.key}`)}</div>
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="tk-settings__btn tk-settings__btn--ghost tk-settings__btn--sm"
            >
              {t("ui.view")}
            </a>
          </div>
        ))}
      </div>

      <div className="tk-settings__card">
        <div className="tk-settings__lbl" style={{ marginBottom: 12 }}>
          {t("ui.consentHistory")}
        </div>
        {acceptedOn ? (
          <div className="flex flex-col gap-3">
            {CONSENT_KEYS.map((key) => (
              <div key={key} className="flex gap-2.5">
                <span className="shrink-0 text-[var(--pos)]" aria-hidden>✓</span>
                <span className="text-[13px] leading-relaxed text-[var(--t2)]">
                  {t(`ui.${key}`)}{" "}
                  <span className="font-sans text-[var(--t3)]">· {t("ui.accepted", { date: acceptedOn })}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] leading-relaxed text-[var(--t2)]">
            {t("ui.consentEmpty")}
          </p>
        )}
      </div>
    </section>
  );
}
