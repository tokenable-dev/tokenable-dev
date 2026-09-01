"use client";

import { useRef } from "react";
import { ASSETS } from "@/constants/assets";
import { TkTag, TkButton } from "@/components/ds";
import { HomeHeroSlabCarousel } from "@/components/home/HomeHeroSlabCarousel";

/** index.html hero Group 4 — static marketing figures for now. */
const HERO_STATS = [
  { value: "128,540", label: "Graded cards", tone: "default" as const },
  { value: "$284M", label: "Vaulted", tone: "default" as const },
  { value: "27%", label: "1 Yr Chg in Value", tone: "pos" as const },
];

export function HomeHero() {
  const heroRef = useRef<HTMLElement>(null);
  const mobileSlotRef = useRef<HTMLDivElement>(null);

  return (
    <section ref={heroRef} className="home-hero">
      {/* Matches index.html `.wrap` right edge for 3D ring placement */}
      <div className="home-hero__ring-align" aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="home-hero__bg" src={ASSETS.home.heroBg} alt="" />
      <div className="home-hero__vignette" aria-hidden />
      <div className="home-hero__fade" aria-hidden />
      <HomeHeroSlabCarousel heroRef={heroRef} mobileSlotRef={mobileSlotRef} />

      <div className="home-hero__content">
        <div className="home-hero__inner">
          <h1 className="home-hero__title home-hero__reveal">
            Markets to trade
            <br />
            Gems and Grails.
          </h1>

          <div className="home-hero__chips home-hero__reveal home-hero__reveal--1">
            <TkTag tone="brand" appearance="soft" className="home-hero__chip">
              Graded
            </TkTag>
            <TkTag tone="brand" appearance="soft" className="home-hero__chip">
              Vaulted
            </TkTag>
            <TkTag tone="brand" appearance="soft" className="home-hero__chip">
              On-chain
            </TkTag>
          </div>

          <div ref={mobileSlotRef} className="home-hero__carousel-mobile" />

          <div className="home-hero__cta home-hero__reveal home-hero__reveal--2">
            <TkButton href="/markets" variant="primary" className="home-hero__browse-btn">
              Browse all markets{" "}
              <span className="home-hero__browse-link-arrow" aria-hidden>
                ↗
              </span>
            </TkButton>
          </div>

          <div
            className="home-hero__stats home-hero__reveal home-hero__reveal--3"
            aria-label="Marketplace stats"
          >
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="home-hero__stat">
                <div
                  className={
                    stat.tone === "pos"
                      ? "home-hero__stat-value home-hero__stat-value--pos tkl-mono"
                      : "home-hero__stat-value tkl-mono"
                  }
                >
                  {stat.value}
                </div>
                <div className="home-hero__stat-label tkl-mono">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="home-hero__scroll" aria-hidden>
        <span className="home-hero__scroll-label">Scroll</span>
        <span className="home-hero__scroll-line" />
      </div>
    </section>
  );
}
