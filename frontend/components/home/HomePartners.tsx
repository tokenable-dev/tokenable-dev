"use client";

import { TkButton } from "@/components/ds/Button";
import { ASSETS } from "@/constants/assets";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";

const PARTNER_LOGOS = [
  { src: ASSETS.ds.partners.psa, alt: "PSA", height: 38 },
  { src: ASSETS.ds.partners.beckett, alt: "Beckett", height: 50 },
  { src: ASSETS.ds.partners.ebay, alt: "eBay", height: 30 },
  { src: ASSETS.ds.partners.cardladder, alt: "Card Ladder", height: 30 },
  { src: ASSETS.ds.partners.gemrate, alt: "GemRate", height: 30 },
  { src: ASSETS.ds.partners.pricecharting, alt: "PriceCharting", height: 30 },
] as const;

export function HomePartners() {
  const navigate = useHeaderNavGate();

  return (
    <section className="tkl-wrap home-partners-section">
      <div className="home-partners__row">
        <span className="home-partners__label">Trusted data &amp; grading partners</span>
        <div className="home-partners__logos">
          {PARTNER_LOGOS.map((logo) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={logo.alt}
              src={logo.src}
              alt={logo.alt}
              style={{ height: logo.height }}
            />
          ))}
        </div>
      </div>

      <div className="home-partners__cta notch">
        <div className="home-partners__cta-glow" aria-hidden />
        <div className="home-partners__cta-copy">
          <span className="home-partners__cta-eyebrow">Get started</span>
          <h2 className="home-partners__cta-title">Vault it. Tokenize it. Trade it.</h2>
          <p className="home-partners__cta-sub">
            Get your cards graded, vault them securely, and trade on-chain with full
            provenance.
          </p>
        </div>
        <div className="home-partners__cta-actions">
          <TkButton variant="primaryInv" size="md" onClick={() => navigate("/vault", 0)}>
            Start selling <span className="tkl-mono text-[17px]">↗</span>
          </TkButton>
        </div>
      </div>
    </section>
  );
}
