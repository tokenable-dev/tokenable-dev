"use client";

import { HomeHero } from "@/components/home/HomeHero";
import { HomeTicker } from "@/components/home/HomeTicker";
import { HomeTopMovers } from "@/components/home/HomeTopMovers";
import { HomeFeatures } from "@/components/home/HomeFeatures";
import { HomeJustVaulted } from "@/components/home/HomeJustVaulted";
import { HomePartners } from "@/components/home/HomePartners";
import "@/styles/tokenable-home.css";

export function HomePageContent() {
  return (
    <div className="home-page">
      <HomeTicker />
      <HomeHero />
      <HomeTopMovers />
      <HomeFeatures />
      <HomeJustVaulted />
      <HomePartners />
    </div>
  );
}
