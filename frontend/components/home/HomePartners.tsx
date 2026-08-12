"use client";

import { TkButton } from "@/components/ds/Button";
import { ASSETS } from "@/constants/assets";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";

const PARTNER_LOGOS = [
  { src: ASSETS.ds.partners.psa, alt: "PSA", height: 25 },
  { src: ASSETS.ds.partners.beckett, alt: "Beckett", height: 34 },
  { src: ASSETS.ds.partners.cgc, alt: "CGC", height: 29 },
  { src: ASSETS.ds.partners.sgc, alt: "SGC", height: 36 },
  { src: ASSETS.ds.partners.tag, alt: "TAG", height: 34 },
] as const;

export function HomePartners() {
  const navigate = useHeaderNavGate();

  return (
    <section className="tkl-wrap home-partners-section">
      <div className="home-partners__row">
        <span className="home-partners__label">Vaults &amp; grading partners</span>
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
