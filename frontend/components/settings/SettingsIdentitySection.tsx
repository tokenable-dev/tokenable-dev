"use client";

import { useRouter } from "next/navigation";
import { isKycComplete } from "@/lib/auth/accountAccess";
import type { AuthUser } from "@/lib/auth";
import { useAuthUiStore } from "@/store/authUiStore";
import { SettingsBtn } from "./SettingsBtn";

const KYC_RETURN_KEY = "tk_kyc_return_to";
const SETTINGS_IDENTITY_PATH = "/settings?section=identity";

function formatVerifiedDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SettingsIdentitySection({ user }: { user: AuthUser }) {
  const router = useRouter();
  const verified = isKycComplete(user);
  const status = user.kycStatus ?? "none";
  const verifiedLabel = formatVerifiedDate(user.kycVerifiedAt);

  let detail: string;
  if (verified) {
    detail = verifiedLabel
      ? `Verified via Sumsub on ${verifiedLabel}.`
      : "Verified via Sumsub.";
  } else if (status === "pending") {
    detail =
      "You started verification but it isn’t finished yet. Continue to reopen Sumsub and complete the remaining steps.";
  } else if (status === "rejected") {
    detail = "Verification was not approved. You can try again.";
  } else {
    detail = "Complete identity verification to sell on Tokenable.";
  }

  function goToKyc() {
    try {
      sessionStorage.setItem(KYC_RETURN_KEY, SETTINGS_IDENTITY_PATH);
    } catch {
      /* ignore */
    }
    useAuthUiStore.setState({
      kycOpen: false,
      pendingReturnTo: SETTINGS_IDENTITY_PATH,
    });
    router.push("/kyc");
  }

  return (
    <section className="tk-settings__sec">
      <h1 className="tk-settings__sec-h">Identity</h1>
      <p className="tk-settings__sec-sub">
        Required to sell. Verified once — you won&rsquo;t be asked again.
      </p>

      <div className="tk-settings__card">
        <div className="tk-settings__row tk-settings__row--stack">
          <div className="tk-settings__row-main flex min-w-0 items-center gap-3.5">
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
                Identity verification
                {status === "pending" ? (
                  <span
                    className="tk-settings__chip tk-settings__chip--warn"
                    style={{ marginLeft: 8 }}
                  >
                    PENDING
                  </span>
                ) : null}
              </div>
              <div className="tk-settings__row-d">{detail}</div>
            </div>
          </div>
          {verified ? (
            <span className="tk-settings__chip tk-settings__chip--pos self-start">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              VERIFIED
            </span>
          ) : (
            <SettingsBtn variant="primary" size="sm" onClick={goToKyc}>
              {status === "pending"
                ? "Continue verification"
                : status === "rejected"
                  ? "Try again"
                  : "Verify identity"}
            </SettingsBtn>
          )}
        </div>
      </div>
    </section>
  );
}
