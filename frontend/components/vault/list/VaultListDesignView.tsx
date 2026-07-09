"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { TkButton, TkTag } from "@/components/ds";
import { VaultBreadcrumb } from "@/components/vault/VaultBreadcrumb";
import { MOCK_CARD } from "@/lib/vault/vaultMockData";

type Method = "buynow" | "offers" | "auction";

export function VaultListDesignView() {
  const [method, setMethod] = useState<Method | null>(null);
  const [duration, setDuration] = useState("7 days");
  const [terms, setTerms] = useState(false);
  const [listed, setListed] = useState(false);

  const price = 25000;
  const fee = Math.round(price * 0.05);
  const receive = price - fee;
  const canList = Boolean(method && terms);

  return (
    <>
      <VaultBreadcrumb
        items={[
          { label: "My Vault", href: "/vault" },
          { label: "List for Sale" },
        ]}
      />

      <span className="vault-list-eyebrow">List for Sale</span>
      <h1 className="vault-list-title">List Your Card</h1>

      <div className="vault-card-summary">
        <div className="vault-card-summary__img">
          <Image src={MOCK_CARD.imageUrl} alt="" width={80} height={112} className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="vault-card-summary__name">{MOCK_CARD.name}</div>
          <div className="vault-card-summary__meta">
            <TkTag tone="neutral" appearance="soft">
              {MOCK_CARD.grade}
            </TkTag>
            <span className="font-mono text-xs text-white/40">Cert #{MOCK_CARD.cert}</span>
            <span className="font-mono text-xs text-[var(--azure)]">Token #{MOCK_CARD.tokenId}</span>
          </div>
          <div className="vault-card-summary__value">
            <span>Current market value</span>
            <span className="font-mono text-base font-bold text-white">
              ${MOCK_CARD.marketValueUsd.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <label className="vault-form-label" style={{ marginBottom: 14 }}>
          Selling method
        </label>
        <div className="vault-method-grid">
          {(
            [
              { id: "buynow" as const, title: "Buy Now", desc: "Set a fixed price. Sell instantly when someone accepts." },
              { id: "offers" as const, title: "Accept Offers", desc: "Let buyers make offers. You accept or decline." },
              { id: "auction" as const, title: "Auction", desc: "Set a starting price. Highest bid wins." },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              className={`vault-method-card text-left${method === m.id ? " selected" : ""}`}
              onClick={() => setMethod(m.id)}
            >
              <div className="vault-method-card__radio" />
              <div className="vault-method-card__title">{m.title}</div>
              <div className="vault-method-card__desc">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {method === "buynow" ? (
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="vault-form-label" style={{ marginBottom: 0 }}>
              Your asking price
            </span>
            <span className="font-mono text-sm font-bold text-white/60">
              ${MOCK_CARD.marketValueUsd.toLocaleString()}
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg font-bold text-white/30">$</span>
            <input className="vault-form-input vault-form-input--price pl-9" type="text" defaultValue="25,000" readOnly />
          </div>
          <div className="vault-ref-prices">
            <div className="vault-ref-prices__title">📊 Recent sales reference</div>
            <div className="vault-ref-row">
              <span className="vault-ref-row__source">eBay</span>
              <span>
                <span className="vault-ref-row__price">$24,500</span>
                <span className="vault-ref-row__date">Jun 28</span>
              </span>
            </div>
            <div className="vault-ref-row">
              <span className="vault-ref-row__source">Goldin</span>
              <span>
                <span className="vault-ref-row__price">$25,376</span>
                <span className="vault-ref-row__date">Jun 15</span>
              </span>
            </div>
            <div className="vault-ref-row">
              <span className="vault-ref-row__source">Tokenable</span>
              <span>
                <span className="vault-ref-row__price">$25,000</span>
                <span className="vault-ref-row__date">Jun 10</span>
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {method === "offers" ? (
        <div className="mb-6">
          <label className="vault-form-label">Minimum offer (optional)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg font-bold text-white/30">$</span>
            <input className="vault-form-input pl-9" type="text" placeholder="20,000" readOnly />
          </div>
          <div className="vault-form-helper">Leave blank to accept any offer</div>
        </div>
      ) : null}

      {method === "auction" ? (
        <div className="mb-6 space-y-4">
          <div>
            <label className="vault-form-label">Starting bid</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg font-bold text-white/30">$</span>
              <input className="vault-form-input pl-9" type="text" placeholder="20,000" readOnly />
            </div>
          </div>
          <div>
            <label className="vault-form-label">Reserve price (optional)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg font-bold text-white/30">$</span>
              <input className="vault-form-input pl-9" type="text" placeholder="24,000" readOnly />
            </div>
          </div>
        </div>
      ) : null}

      {method === "auction" ? (
        <div className="mb-6">
          <label className="vault-form-label">Duration</label>
          <div className="vault-duration-group">
            {["3 days", "7 days", "14 days"].map((d) => (
              <button
                key={d}
                type="button"
                className={`vault-duration-btn${duration === d ? " selected" : ""}`}
                onClick={() => setDuration(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {method ? (
        <div className="vault-fee-table">
          <div className="vault-fee-row">
            <span className="vault-fee-row__label">Asking price</span>
            <span className="vault-fee-row__val">${price.toLocaleString()}</span>
          </div>
          <div className="vault-fee-row">
            <span className="vault-fee-row__label">Platform fee (5%)</span>
            <span className="vault-fee-row__val" style={{ color: "var(--neg)" }}>
              -${fee.toLocaleString()}
            </span>
          </div>
          <div className="vault-fee-row vault-fee-row--total">
            <span className="vault-fee-row__label">You receive</span>
            <span className="vault-fee-row__val" style={{ color: "var(--pos)", fontSize: 20 }}>
              ${receive.toLocaleString()}
            </span>
          </div>
        </div>
      ) : null}

      <div
        className={`vault-terms-check${terms ? " checked" : ""}`}
        onClick={() => setTerms((t) => !t)}
        onKeyDown={(e) => e.key === "Enter" && setTerms((t) => !t)}
        role="checkbox"
        aria-checked={terms}
        tabIndex={0}
      >
        <div className="vault-terms-check__box">
          {terms ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : null}
        </div>
        <div className="vault-terms-check__text">
          I confirm this card is currently vaulted at Tokenable&apos;s PSA facility and I have the right to sell this
          token.
        </div>
      </div>

      <div className={`vault-success-banner${listed ? " show" : ""}`}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="2.5" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <div>
          <div className="vault-success-banner__title">Your card is now listed on Tokenable Markets</div>
          <div className="flex flex-wrap justify-center gap-3 vault-success-banner__actions">
            <Link href="/markets">
              <TkButton decorative variant="primary" size="sm" className="h-[42px] px-5 text-sm">
                View Listing →
              </TkButton>
            </Link>
            <Link href="/vault">
              <TkButton decorative variant="subtle" size="sm" className="h-[42px] px-5 text-sm">
                Back to Vault →
              </TkButton>
            </Link>
          </div>
        </div>
      </div>

      {!listed ? (
        <>
          <div className="vault-desktop-cta">
            <TkButton
              variant="primary"
              size="md"
              className="h-[54px] w-full justify-center text-base"
              disabled={!canList}
              style={{ opacity: canList ? 1 : 0.4 }}
              onClick={() => setListed(true)}
            >
              List for Sale →
            </TkButton>
            <Link href="/vault" className="mt-3 inline-flex w-full">
              <TkButton decorative variant="subtle" size="md" className="h-12 w-full justify-center text-sm text-white/50">
                Cancel
              </TkButton>
            </Link>
          </div>

          <div className="vault-mobile-sticky-cta">
            <TkButton
              variant="primary"
              size="md"
              className="h-[52px] w-full justify-center text-[15px]"
              disabled={!canList}
              style={{ opacity: canList ? 1 : 0.4 }}
              onClick={() => setListed(true)}
            >
              List for Sale →
            </TkButton>
          </div>
        </>
      ) : null}
    </>
  );
}
