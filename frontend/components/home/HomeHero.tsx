"use client";

import { useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ASSETS } from "@/constants/assets";
import { TkButton, TkTag } from "@/components/ds";
import { HomeHeroSlabCarousel } from "@/components/home/HomeHeroSlabCarousel";
import { buildCollectionSearchHref } from "@/lib/markets/marketsUrlFilters";
import { trackEvent } from "@/lib/analytics/googleAnalytics";

/** index.html hero Group 4 — static marketing figures for now. */
const HERO_STATS = [
  { value: "128,540", label: "Graded cards", tone: "default" as const },
  { value: "61,420", label: "Cards secured", tone: "default" as const },
  { value: "+18.4%", label: "Index · 1Y", tone: "pos" as const },
];

export function HomeHero() {
  const heroRef = useRef<HTMLElement>(null);
  const mobileSlotRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  function onSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "");
    trackEvent("search_performed", { query: q.trim(), results_count: 0 });
    router.push(buildCollectionSearchHref(q));
  }

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
            <form className="home-hero__search" onSubmit={onSearchSubmit} role="search">
              <svg
                className="home-hero__search-icon"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(0,0,0,0.4)"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
              </svg>
              <input
                className="home-hero__search-input"
                type="search"
                name="q"
                placeholder="Find your card — name, cert #, set, player…"
                autoComplete="off"
                aria-label="Search cards"
              />
              <TkButton type="submit" variant="primary" className="home-hero__search-btn">
                Search{" "}
                <span className="home-hero__search-btn-arrow" aria-hidden>
                  ↗
                </span>
              </TkButton>
            </form>
            <a href="/markets" className="home-hero__browse-link">
              Browse all markets{" "}
              <span className="home-hero__browse-link-arrow" aria-hidden>
                ↗
              </span>
            </a>
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
