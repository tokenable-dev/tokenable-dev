"use client";

import { useLayoutEffect } from "react";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeTicker } from "@/components/home/HomeTicker";
import { HomeTopMovers } from "@/components/home/HomeTopMovers";
import { HomeFeatures } from "@/components/home/HomeFeatures";
import { HomeJustVaulted } from "@/components/home/HomeJustVaulted";
import { HomePaySection } from "@/components/home/HomePaySection";
import { HomePartners } from "@/components/home/HomePartners";
import "@/styles/tokenable-home.css";

export function HomePageContent() {
  useLayoutEffect(() => {
    if (window.location.hash) return;
    if (!window.matchMedia("(max-width: 768px)").matches) return;

    let userMoved = false;
    const markMoved = () => {
      userMoved = true;
    };
    const pinTop = () => {
      if (userMoved) return;
      const root = document.scrollingElement;
      if (root && root.scrollTop !== 0) root.scrollTop = 0;
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      const search = document.querySelector<HTMLInputElement>(
        ".home-hero__search-field input",
      );
      if (search && document.activeElement === search) search.blur();
    };

    pinTop();
    const raf = window.requestAnimationFrame(pinTop);
    const soon = window.setTimeout(pinTop, 0);
    const later = window.setTimeout(pinTop, 150);
    window.addEventListener("touchstart", markMoved, { passive: true, once: true });
    window.addEventListener("wheel", markMoved, { passive: true, once: true });
    window.addEventListener("pageshow", pinTop);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(soon);
      window.clearTimeout(later);
      window.removeEventListener("touchstart", markMoved);
      window.removeEventListener("wheel", markMoved);
      window.removeEventListener("pageshow", pinTop);
    };
  }, []);

  return (
    <div className="home-page">
      <HomeTicker />
      <HomeHero />
      <HomeTopMovers />
      <HomeFeatures />
      <HomeJustVaulted />
      <HomePaySection />
      <HomePartners />
    </div>
  );
}
