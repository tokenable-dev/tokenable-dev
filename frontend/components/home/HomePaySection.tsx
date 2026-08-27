"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ASSETS } from "@/constants/assets";

const APPLE = "\uF8FF";

function McDots() {
  return (
    <>
      <span className="home-pay__mc-dot" style={{ background: "#EB001B", marginRight: -6 }} />
      <span className="home-pay__mc-dot" style={{ background: "#F79E1B", opacity: 0.9 }} />
    </>
  );
}

function MoonPayMark() {
  return (
    <svg width="50" height="50" viewBox="0 0 100 100" aria-hidden>
      <circle cx="40" cy="58" r="22" fill="#fff" />
      <circle cx="70" cy="33" r="11" fill="#fff" />
    </svg>
  );
}

function CoinbaseMark() {
  return (
    <svg width="44" height="44" viewBox="0 0 1024 1024" aria-hidden>
      <circle cx="512" cy="512" r="512" fill="#0052FF" />
      <path
        fill="#fff"
        d="M512 692c-99 0-180-81-180-180s81-180 180-180c89 0 163 65 178 150h181C854 320 700 176 512 176 326 176 176 326 176 512s150 336 336 336c188 0 342-144 359-306H690c-15 85-89 150-178 150z"
      />
    </svg>
  );
}

function BankMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21h18M5 21V10M19 21V10M4 10l8-6 8 6M9 21v-6h6v6" />
    </svg>
  );
}

function UsdcMark() {
  return (
    <svg width="46" height="46" viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="50" fill="#2775CA" />
      <text x="50" y="68" fontFamily="Inter,sans-serif" fontSize="52" fontWeight="600" fill="#fff" textAnchor="middle">
        $
      </text>
      <circle cx="50" cy="50" r="33" fill="none" stroke="#fff" strokeWidth="6" strokeDasharray="78 30" transform="rotate(-45 50 50)" />
    </svg>
  );
}

function UsdtMark() {
  return (
    <svg width="46" height="46" viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="50" fill="#26A17B" />
      <rect x="26" y="28" width="48" height="12" rx="1" fill="#fff" />
      <rect x="44" y="32" width="12" height="44" fill="#fff" />
      <ellipse cx="50" cy="48" rx="22" ry="8" fill="none" stroke="#fff" strokeWidth="5" />
    </svg>
  );
}

function EthMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 256 417" aria-hidden>
      <path fill="#fff" fillOpacity="0.6" d="M127.9 0l-2.8 9.5v276.9l2.8 2.8 127.9-75.6z" />
      <path fill="#fff" d="M127.9 0L0 213.6l127.9 75.6V154.2z" />
      <path fill="#fff" fillOpacity="0.6" d="M127.9 312.2l-1.6 1.9v98.6l1.6 4.7L256 237.8z" />
      <path fill="#fff" d="M127.9 417.4v-105.2L0 237.8z" />
    </svg>
  );
}

function SolMark() {
  return (
    <svg width="44" height="44" viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="50" fill="#000" />
      <path d="M35 32 h38 l-8 10 h-38 z" fill="#00FFA3" />
      <path d="M27 45 h38 l8 10 h-38 z" fill="#00FFA3" />
      <path d="M35 58 h38 l-8 10 h-38 z" fill="#00FFA3" />
    </svg>
  );
}

type Tok = {
  id: string;
  bg: string;
  className?: string;
  node: ReactNode;
};

function tokens(): Tok[] {
  /* eslint-disable @next/next/no-img-element */
  const p = ASSETS.ds.pay;
  return [
    { id: "visa", bg: "#fff", node: <img src={p.visa} alt="" style={{ width: 58 }} /> },
    { id: "mc", bg: "#16161c", className: "home-pay__tok--mc", node: <McDots /> },
    { id: "amex", bg: "#1a7ae4", className: "home-pay__tok--cover", node: <img src={p.amex} alt="" /> },
    { id: "disc", bg: "#fff", className: "home-pay__tok--cover", node: <img src={p.discover} alt="" style={{ width: 70, height: "auto" }} /> },
    { id: "apay", bg: "#fff", className: "home-pay__tok--apple", node: `${APPLE}Pay` },
    { id: "gpay", bg: "#fff", node: <img src={p.gpay} alt="" style={{ width: 64 }} /> },
    { id: "pp", bg: "#fff", node: <img src={p.paypal} alt="" style={{ width: 50 }} /> },
    { id: "stripe", bg: "#635BFF", className: "home-pay__tok--cover", node: <img src={p.stripe} alt="" /> },
    { id: "moon", bg: "#7D00FF", node: <MoonPayMark /> },
    { id: "cb", bg: "#0052FF", node: <CoinbaseMark /> },
    { id: "bank", bg: "#20232b", node: <BankMark /> },
    { id: "usdc", bg: "#2775CA", node: <UsdcMark /> },
    { id: "usdt", bg: "#26A17B", node: <UsdtMark /> },
    { id: "eth", bg: "#6481E7", node: <EthMark /> },
    { id: "sol", bg: "#000", node: <SolMark /> },
  ];
}

/** index.html `.pay-sec` — conveyor + checkout phone (design system-23). */
export function HomePaySection() {
  const loop = tokens();
  const belt = [...loop, ...loop];

  return (
    <section className="home-pay" aria-labelledby="home-pay-title">
      <div className="home-pay__conveyor" aria-hidden>
        {belt.map((tok, i) => (
          <div
            key={`${tok.id}-${i}`}
            className={`home-pay__tok${tok.className ? ` ${tok.className}` : ""}`}
            style={{ background: tok.bg, animationDelay: `${-i}s` }}
          >
            {tok.node}
          </div>
        ))}
      </div>

      <div className="home-pay__inner">
        <div className="home-pay__grid">
          <div className="home-pay__copy">
            <h2 id="home-pay-title" className="tkl-sec-title">
              Every payment, one platform.
            </h2>
            <p className="tkl-sec-sub home-pay__sub">
              Card, bank, Apple &amp; Google Pay, or crypto — it all flows into your Tokenable
              balance in US dollars. A secure wallet is created for you automatically; trade
              instantly.
            </p>
            <div className="home-pay__chips">
              <span className="home-pay__chip">Card</span>
              <span className="home-pay__chip">Apple / Google Pay</span>
              <span className="home-pay__chip">Bank</span>
              <span className="home-pay__chip">Crypto</span>
              <span className="home-pay__chip home-pay__chip--pos">USD balance</span>
            </div>
            <Link href="/markets" className="tk-btn tk-btn--primary home-pay__cta">
              Start trading <span className="tkl-mono">→</span>
            </Link>
          </div>

          <div className="home-pay__phone-wrap">
            <div className="home-pay__phone">
              <div className="home-pay__phone-glow" aria-hidden />
              <div className="home-pay__bezel">
                <div className="home-pay__screen">
                  <div className="home-pay__checkout">
                    <div className="home-pay__checkout-title">Checkout</div>
                    <div className="home-pay__item">
                      <div className="home-pay__item-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ASSETS.ds.cards.charizard} alt="" />
                      </div>
                      <div className="home-pay__item-copy">
                        <div className="home-pay__item-name">Charizard ex</div>
                        <div className="home-pay__item-meta tkl-mono">PSA 10 · Vaulted</div>
                      </div>
                      <div className="home-pay__item-price tkl-mono">$9,000</div>
                    </div>
                    <div className="home-pay__paywith tkl-mono">Pay with</div>
                    <div className="home-pay__methods">
                      <div className="home-pay__method home-pay__method--on">
                        <span className="home-pay__method-ic home-pay__method-ic--apple">{APPLE}</span>
                        <span className="home-pay__method-lbl">Apple Pay</span>
                        <span className="home-pay__radio home-pay__radio--on" aria-hidden>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      </div>
                      <div className="home-pay__method">
                        <span className="home-pay__method-ic home-pay__method-ic--visa">VISA</span>
                        <span className="home-pay__method-lbl">Card •••• 4242</span>
                        <span className="home-pay__radio" aria-hidden />
                      </div>
                      <div className="home-pay__method">
                        <span className="home-pay__method-ic home-pay__method-ic--usdc">$</span>
                        <span className="home-pay__method-lbl">USDC balance</span>
                        <span className="home-pay__radio" aria-hidden />
                      </div>
                    </div>
                    <div className="home-pay__foot">
                      <div className="home-pay__total">
                        <span className="tkl-mono">Total</span>
                        <span className="home-pay__total-n">$9,000</span>
                      </div>
                      <span className="tk-btn tk-btn--primary home-pay__pay-btn">Pay</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
