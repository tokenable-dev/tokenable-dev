"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ASSETS } from "@/constants/assets";
import { HomeHeroSearch } from "@/components/home/HomeHeroSearch";

const HERO_POINTS = [
  {
    titleKey: "authenticated",
    copyKey: "authenticatedCopy",
    icon: ASSETS.home.heroIconGraded,
  },
  {
    titleKey: "vaulted",
    copyKey: "vaultedCopy",
    icon: ASSETS.home.heroIconVaulted,
  },
  {
    titleKey: "onChain",
    copyKey: "onChainCopy",
    icon: ASSETS.home.heroIconOnchain,
  },
] as const;

export function HomeHero() {
  const t = useTranslations("Home");
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
            {t("heroLine1")}
            <br />
            {t("heroLine2")}
          </h1>

          <HomeHeroSearch />

          <ul className="home-hero__points home-hero__reveal home-hero__reveal--3">
            {HERO_POINTS.map(({ titleKey, copyKey, icon }) => (
              <li key={titleKey} className="home-hero__point">
                <span className="home-hero__point-icon">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={icon} alt="" />
                </span>
                <span className="home-hero__point-title">{t(titleKey)}</span>
                <span className="home-hero__point-copy">{t(copyKey)}</span>
              </li>
            ))}
          </ul>

          <div className="home-hero__cta home-hero__reveal home-hero__reveal--4">
            <Link href="/markets" className="home-hero__browse">
              {t("browse")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
