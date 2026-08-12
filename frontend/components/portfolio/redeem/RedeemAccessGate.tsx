"use client";

import { TkButton } from "@/components/ds";
import type { HeaderNavGateResult } from "@/lib/auth/accountAccess";
import type { KycStatus } from "@/lib/auth/auth";

type GateAction = HeaderNavGateResult["action"];

function gateCopy(
  action: Exclude<GateAction, "allow">,
  kycStatus: KycStatus | undefined,
): { title: string; body: string; sub: string | null; cta: string } {
  if (action === "sign-in") {
    return {
      title: "Sign in to ship a card",
      body: "Shipping moves a physical card out of the vault, so we need to know whose account it is leaving.",
      sub: null,
      cta: "Sign in",
    };
  }
  if (action === "connect-wallet") {
    return {
      title: "Connect a wallet to ship a card",
      body: "Your cards live in the wallet linked to this account. Connect it so we can release the right ones.",
      sub: null,
      cta: "Connect wallet",
    };
  }
  if (kycStatus === "pending") {
    return {
      title: "Verification in progress",
      body: "Your identity check is still under review. This usually takes 1–2 minutes — you can continue verification or come back once it clears.",
      sub: "Your address and cards are saved. Nothing is charged until you pay.",
      cta: "Continue verification",
    };
  }
  if (kycStatus === "rejected") {
    return {
      title: "Verification needs another look",
      body: "We couldn’t approve your identity yet. Resubmit your ID and liveness check so we can ship a physical card to you.",
      sub: "Buying, selling and moving funds don’t need this.",
      cta: "Try again",
    };
  }
  return {
    title: "Verify your identity to ship a card",
    body: "We ship only to a verified owner, so your card reaches the right hands.",
    sub: "One time only — you won’t be asked again. Buying, selling and moving funds don’t need this.",
    cta: "Verify identity",
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
  const { title, body, sub, cta } = gateCopy(action, kycStatus);

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
  return (
    <p className="pf-redeem-verified tkl-mono">
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
      Identity verified
    </p>
  );
}
