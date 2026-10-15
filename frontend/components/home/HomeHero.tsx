"use client";

import Link from "next/link";
import { ASSETS } from "@/constants/assets";
import { HomeHeroSearch } from "@/components/home/HomeHeroSearch";

const HERO_CHIPS = ["Graded", "Vaulted", "On-chain"] as const;

export function HomeHero() {
  return (
    <section className="home-hero">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="home-hero__bg" src={ASSETS.home.heroBg} alt="" />
      <div className="home-hero__vignette" aria-hidden />
      <div className="home-hero__center-vignette" aria-hidden />
      <div className="home-hero__bottom-fade" aria-hidden />

      <div className="home-hero__content">
        <div className="home-hero__inner">
          <h1 className="home-hero__title home-hero__reveal">
            Safest. Fastest.
            <br />
            Collectibles Trading.
          </h1>

          <HomeHeroSearch />

          <div className="home-hero__chips home-hero__reveal home-hero__reveal--3">
            {HERO_CHIPS.map((label) => (
              <span key={label} className="home-hero__chip">
                <span className="home-hero__chip-dot" aria-hidden />
                {label}
              </span>
            ))}
          </div>

          <div className="home-hero__cta home-hero__reveal home-hero__reveal--4">
            <Link href="/markets" className="home-hero__browse">
              Browse all markets →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
