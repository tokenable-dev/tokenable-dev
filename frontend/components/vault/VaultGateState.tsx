"use client";

import { TkButton } from "@/components/ds";
import { WalletConnect } from "@/components/wallet/WalletConnect";

function VaultLockIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--azure)" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  );
}

export function VaultGateState({
  onContinue,
  showWalletConnect = false,
}: {
  onContinue: () => void;
  showWalletConnect?: boolean;
}) {
  return (
    <div className="vault-gate">
      <div className="vault-gate__icon">
        <VaultLockIcon />
      </div>
      <h2 className="vault-gate__title">
        Vault your cards.
        <br />
        <span>Own the token.</span>
      </h2>
      <p className="vault-gate__text">
        Sign in and complete verification to submit PSA-graded cards. We verify your cert,
        mint your token, and enable on-chain trading without shipping each sale.
      </p>
      {showWalletConnect ? (
        <div className="flex justify-center">
          <WalletConnect />
        </div>
      ) : (
        <TkButton variant="primary" onClick={onContinue}>
          Continue
        </TkButton>
      )}
    </div>
  );
}
