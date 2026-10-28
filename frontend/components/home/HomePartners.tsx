"use client";

import { useTranslations } from "next-intl";
import { TkButton } from "@/components/ds/Button";
import { ASSETS } from "@/constants/assets";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";

const PARTNER_LOGOS = [
  { src: ASSETS.ds.partners.psa, alt: "PSA", height: 44 },
  { src: ASSETS.ds.partners.beckett, alt: "Beckett", height: 64 },
  { src: ASSETS.ds.partners.ebay, alt: "eBay", height: 40 },
  { src: ASSETS.ds.partners.cardladder, alt: "Card Ladder", height: 40 },
  { src: ASSETS.ds.partners.gemrate, alt: "GemRate", height: 40 },
  { src: ASSETS.ds.partners.pricecharting, alt: "PriceCharting", height: 40 },
] as const;

export function HomePartners() {
  const t = useTranslations("Home");
  const navigate = useHeaderNavGate();

  return (
    <section className="tkl-wrap home-partners-section">
      <div className="home-partners__row">
        <span className="home-partners__label">{t("sources")}</span>
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
          <span className="home-partners__cta-eyebrow">{t("getStarted")}</span>
          <h2 className="home-partners__cta-title">{t("vaultTrade")}</h2>
          <p className="home-partners__cta-sub">{t("vaultTradeCopy")}</p>
        </div>
        <div className="home-partners__cta-actions">
          <TkButton
            variant="primaryInv"
            size="md"
            className="home-partners__cta-btn"
            onClick={() => navigate("/vault", 0)}
          >
            {t("startSelling")}
          </TkButton>
        </div>
      </div>
    </section>
  );
}
