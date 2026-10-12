"use client";

import { useRef } from "react";
import { ASSETS } from "@/constants/assets";
import { TkButton } from "@/components/ds";
import { HomeHeroSlabCarousel } from "@/components/home/HomeHeroSlabCarousel";

const HERO_CHIPS = ["Graded", "Vaulted", "On-chain"] as const;

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
      <HomeHeroSlabCarousel heroRef={heroRef} mobileSlotRef={mobileSlotRef} />

      <div className="home-hero__content">
        <div className="home-hero__inner">
          <h1 className="home-hero__title home-hero__reveal">
            The safest and fastest way
            <br />
            to trade collectibles.
          </h1>

          <div className="home-hero__chips home-hero__reveal home-hero__reveal--1">
            {HERO_CHIPS.map((label) => (
              <span key={label} className="home-hero__chip">
                <span className="home-hero__chip-dot" aria-hidden />
                {label}
              </span>
            ))}
          </div>

          <div ref={mobileSlotRef} className="home-hero__carousel-mobile" />

          <div className="home-hero__cta home-hero__reveal home-hero__reveal--2">
            <TkButton href="/markets" variant="primary" className="home-hero__browse-btn">
              Browse all markets
            </TkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
