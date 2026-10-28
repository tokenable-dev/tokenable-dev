"use client";

import { useTranslations } from "next-intl";
import { TkButton } from "@/components/ds";
import type { HeaderNavGateResult } from "@/lib/auth/accountAccess";
import type { KycStatus } from "@/lib/auth/auth";

type GateAction = HeaderNavGateResult["action"];

function gateCopy(
  action: Exclude<GateAction, "allow">,
  kycStatus: KycStatus | undefined,
  t: ReturnType<typeof useTranslations<"AuthGate">>,
): { title: string; body: string; sub: string | null; cta: string } {
  if (action === "sign-in") {
    return {
      title: t("shipTitle"),
      body: t("shipBody"),
      sub: null,
      cta: t("signIn"),
    };
  }
  if (action === "connect-wallet") {
    return {
      title: t("walletTitle"),
      body: t("walletBody"),
      sub: null,
      cta: t("connectWallet"),
    };
  }
  if (kycStatus === "pending") {
    return {
      title: t("pendingTitle"),
      body: t("pendingBody"),
      sub: t("pendingSub"),
      cta: t("pendingCta"),
    };
  }
  if (kycStatus === "rejected") {
    return {
      title: t("rejectedTitle"),
      body: t("rejectedBody"),
      sub: t("rejectedSub"),
      cta: t("rejectedCta"),
    };
  }
  return {
    title: t("verifyTitle"),
    body: t("verifyBody"),
    sub: t("verifySub"),
    cta: t("verifyCta"),
  };
}

/**
 * Shipping a physical card is the one action that needs a verified owner, so
 * Step 1 blocks up front instead of letting the address and quote be filled in
 * and then failing at pay time.
 */
export function RedeemAccessGate({
  action,
  kycStatus,
  onContinue,
}: {
  action: Exclude<GateAction, "allow">;
  kycStatus?: KycStatus;
  onContinue: () => void;
}) {
  const t = useTranslations("AuthGate");
  const { title, body, sub, cta } = gateCopy(action, kycStatus, t);

  return (
    <div className="pf-redeem-gate">
      <span className="pf-redeem-gate__icon" aria-hidden>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11.5 14.5 16 10" strokeWidth="2.5" />
        </svg>
      </span>
      <div className="pf-redeem-gate__body">
        <strong className="pf-redeem-gate__title">{title}</strong>
        <p className="pf-redeem-gate__copy">{body}</p>
        {sub ? <p className="pf-redeem-gate__sub">{sub}</p> : null}
        <TkButton
          type="button"
          variant="primary"
          className="pf-redeem-gate__cta"
          onClick={onContinue}
        >
          {cta}
        </TkButton>
      </div>
    </div>
  );
}

export function RedeemVerifiedChip() {
  const t = useTranslations("AuthGate");
  return (
    <p className="pf-redeem-verified">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        aria-hidden
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {t("verified")}
    </p>
  );
}
