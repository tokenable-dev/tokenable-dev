"use client";

import Link from "next/link";
import { ASSETS } from "@/constants/assets";
import { HomeHeroSearch } from "@/components/home/HomeHeroSearch";

const HERO_POINTS = [
  {
    title: "Authenticated",
    copy: "PSA and BGS certified",
    icon: ASSETS.home.heroIconGraded,
  },
  {
    title: "Vaulted",
    copy: "Stored and insured",
    icon: ASSETS.home.heroIconVaulted,
  },
  {
    title: "On-chain",
    copy: "Instant settlement",
    icon: ASSETS.home.heroIconOnchain,
  },
] as const;

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

          <ul className="home-hero__points home-hero__reveal home-hero__reveal--3">
            {HERO_POINTS.map(({ title, copy, icon }) => (
              <li key={title} className="home-hero__point">
                <span className="home-hero__point-icon">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={icon} alt="" />
                </span>
                <span className="home-hero__point-title">{title}</span>
                <span className="home-hero__point-copy">{copy}</span>
              </li>
            ))}
          </ul>

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
