"use client";

import { useRef } from "react";
import { TkButton } from "@/components/ds";
import { HomeHeroSlabCarousel } from "@/components/home/HomeHeroSlabCarousel";

export function HomeHero() {
  const heroRef = useRef<HTMLElement>(null);
  const mobileSlotRef = useRef<HTMLDivElement>(null);

  return (
    <section ref={heroRef} className="home-hero">
      <HomeHeroSlabCarousel heroRef={heroRef} mobileSlotRef={mobileSlotRef} />

      <div className="home-hero__vignette" aria-hidden />
      <div className="home-hero__bottom-fade" aria-hidden />

      <div className="home-hero__content">
        <div className="home-hero__inner">
          <h1 className="home-hero__title">
            Onchain markets
            <br />
            to Trade
            <br />
            Gems and Grails.
          </h1>

          <div className="home-hero__chips">
            <span className="pchip home-hero__chip">Graded</span>
            <span className="pchip home-hero__chip">Vaulted</span>
            <span className="pchip home-hero__chip">On-chain</span>
          </div>

          <div ref={mobileSlotRef} className="home-hero__carousel-mobile" />

          <div className="home-hero__cta">
            <TkButton
              href="/markets"
              variant="primary"
              className="!h-[58px] !px-[30px] !text-[17px]"
            >
              Browse the market <span className="tkl-mono text-[19px]">↗</span>
            </TkButton>
            <a href="#home-features" className="home-hero__link">
              How it works
            </a>
          </div>

          <div className="home-hero__stats">
            <div>
              <div className="home-hero__stat-val">$248M</div>
              <div className="home-hero__stat-label">Vaulted volume</div>
            </div>
            <div>
              <div className="home-hero__stat-val">61,420</div>
              <div className="home-hero__stat-label">Cards secured</div>
            </div>
            <div>
              <div className="home-hero__stat-val home-hero__stat-val--pos">+18.4%</div>
              <div className="home-hero__stat-label">Index · 1Y</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
