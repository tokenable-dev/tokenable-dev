"use client";

import { useRef } from "react";
import { ASSETS } from "@/constants/assets";
import { TkButton, TkTag } from "@/components/ds";
import { HomeHeroSlabCarousel } from "@/components/home/HomeHeroSlabCarousel";

export function HomeHero() {
  const heroRef = useRef<HTMLElement>(null);
  const mobileSlotRef = useRef<HTMLDivElement>(null);

  return (
    <section ref={heroRef} className="home-hero">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="home-hero__bg" src={ASSETS.home.heroBg} alt="" />
      <div className="home-hero__vignette" aria-hidden />
      <div className="home-hero__fade" aria-hidden />
      <HomeHeroSlabCarousel heroRef={heroRef} mobileSlotRef={mobileSlotRef} />

      <div className="home-hero__content">
        <div className="home-hero__inner">
          <div className="home-hero__chips home-hero__reveal">
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

          <h1 className="home-hero__title home-hero__reveal home-hero__reveal--1">
            The card market,
            <br />
            finally liquid.
          </h1>

          <p className="home-hero__lede home-hero__reveal home-hero__reveal--2">
            Every slab authenticated, insured, and tokenized before it hits the
            book. Trade in seconds — ship the real thing whenever you want.
          </p>

          <div ref={mobileSlotRef} className="home-hero__carousel-mobile" />

          <div className="home-hero__cta home-hero__reveal home-hero__reveal--3">
            <TkButton href="/markets" variant="primary" className="home-hero__cta-primary">
              Browse markets <span aria-hidden>↗</span>
            </TkButton>
            <TkButton href="#home-features" variant="ghost" className="home-hero__cta-ghost">
              How it works
            </TkButton>
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
