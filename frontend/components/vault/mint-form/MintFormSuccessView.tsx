"use client";

import { TkButton } from "@/components/ds";

export function MintFormSuccessView({
  txHash,
  onReset,
}: {
  txHash: string;
  onReset: () => void;
}) {
  return (
    <div className="vault-success-panel">
      <div className="text-center mb-6">
        <div className="vault-success-panel__icon" aria-hidden>
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white">Asset minted successfully</h3>
        <p className="mt-2 text-sm text-[var(--t2)]">
          <span className="vault-badge vault-badge--vaulted">Confirmed on-chain</span>
        </p>
      </div>
      <div className="space-y-3">
        <div className="rounded-xl bg-[#141420] p-4">
          <p className="text-xs text-[var(--t3)] mb-1">Transaction hash</p>
          <p className="text-xs font-mono text-[var(--azure)] break-all">{txHash}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <TkButton variant="primary" href="/portfolio" className="flex-1 justify-center">
          Portfolio
        </TkButton>
        <TkButton variant="neutral" onClick={onReset} className="flex-1 justify-center">
          Tokenize another
        </TkButton>
      </div>
    </div>
  );
}
