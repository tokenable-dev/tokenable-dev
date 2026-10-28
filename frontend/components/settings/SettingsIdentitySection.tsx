"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { isKycComplete } from "@/lib/auth/accountAccess";
import type { AuthUser } from "@/lib/auth";
import { rememberKycReturnTo } from "@/lib/kyc/returnPath";
import { useAuthUiStore } from "@/store/authUiStore";
import { SettingsBtn } from "./SettingsBtn";

const SETTINGS_IDENTITY_PATH = "/settings?section=identity";

function formatVerifiedDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SettingsIdentitySection({ user }: { user: AuthUser }) {
  const t = useTranslations("Settings");
  const locale = useLocale();
  const router = useRouter();
  const verified = isKycComplete(user);
  const status = user.kycStatus ?? "none";
  const verifiedLabel = formatVerifiedDate(user.kycVerifiedAt, locale);

  let detail: string;
  if (verified) {
    detail = verifiedLabel
      ? t("ui.verifiedOn", { date: verifiedLabel })
      : t("ui.verifiedPlain");
  } else if (status === "pending") {
    detail = t("ui.pendingDetail");
  } else if (status === "rejected") {
    detail = t("ui.rejectedDetail");
  } else {
    detail = t("ui.noneDetail");
  }

  function goToKyc() {
    rememberKycReturnTo(SETTINGS_IDENTITY_PATH);
    useAuthUiStore.getState().setPendingReturnTo(SETTINGS_IDENTITY_PATH);
    useAuthUiStore.setState({ kycOpen: false });
    router.push("/kyc");
  }

  return (
    <section className="tk-settings__sec">
      <h1 className="tk-settings__sec-h">{t("nav.identity")}</h1>
      <p className="tk-settings__sec-sub">
        {t("ui.identitySub")}
      </p>

      <div className="tk-settings__card">
        <div className="tk-settings__row">
          <div className="flex min-w-0 items-center gap-3.5">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: verified
                  ? "rgba(0,200,100,0.12)"
                  : "rgba(255,255,255,0.06)",
              }}
              aria-hidden
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke={verified ? "var(--pos)" : "var(--t2)"}
                strokeWidth="2.5"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                {verified ? <polyline points="9 12 11 14 15 10" /> : null}
              </svg>
            </span>
            <div className="min-w-0">
              <div className="tk-settings__row-t">
                {t("ui.identityTitle")}
                {status === "pending" ? (
                  <span
                    className="tk-settings__chip tk-settings__chip--warn"
                    style={{ marginLeft: 8 }}
                  >
                    {t("ui.pending")}
                  </span>
                ) : null}
              </div>
              <div className="tk-settings__row-d">{detail}</div>
            </div>
          </div>
          {verified ? (
            <span className="tk-settings__chip tk-settings__chip--pos shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t("ui.verified")}
            </span>
          ) : (
            <SettingsBtn variant="primary" size="sm" className="shrink-0" onClick={goToKyc}>
              {status === "pending"
                ? t("ui.continueVerify")
                : status === "rejected"
                  ? t("ui.tryAgain")
                  : t("ui.verifyIdentity")}
            </SettingsBtn>
          )}
        </div>
      </div>
    </section>
  );
}
