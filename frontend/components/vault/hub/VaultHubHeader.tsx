"use client";

import Link from "next/link";

/** Sell hub header — Vault-Dashboard-Active.html */
export function VaultHubHeader() {
  return (
    <div className="vault-dash-head">
      <h1 className="vault-dash-title">Sell</h1>
      <Link href="/sell/flow" className="vault-dash-add">
        <span className="vault-dash-add__ic" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
        <span className="vault-dash-add__t">Sell cards</span>
        <svg className="vault-dash-add__arr" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>
      <h2 className="vault-dash-sec">Vaulting progress</h2>
    </div>
  );
}
