"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { TrendingCollectionsCarousel } from "@/components/landing/TrendingCollectionsCarousel";
import { LandingOffersSection } from "@/components/landing/LandingOffersSection";
import { MarketIndexes } from "@/components/landing/MarketIndexes";
import { useSellAccessGate } from "@/hooks/auth/useSellAccessGate";

export default function LandingPage() {
  const { navigateToVault } = useSellAccessGate("/vault");

  return (
    <div className="relative min-h-screen overflow-x-clip bg-black text-white">
      <div
        className="landing-grid-drift pointer-events-none absolute inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Hero — mobile: natural height (avoid 100svh jumps when browser chrome shows/hides) */}
      <section className="relative z-10 flex flex-col max-sm:px-4 max-sm:pt-6 max-sm:pb-6 sm:items-center sm:px-6 sm:pt-28 sm:pb-20">
        <div className="flex w-full flex-col items-center max-sm:gap-3">
          <h1
            className="landing-enter mb-2 max-w-4xl text-center text-[1.48rem] font-bold leading-[1.18] tracking-tight text-white max-sm:px-1 sm:mb-5 sm:text-4xl sm:leading-tight md:text-5xl lg:text-[3.25rem] lg:leading-[1.12]"
            style={{ "--landing-enter-delay": "0s" } as CSSProperties}
          >
            Tokenized collectibles markets
          </h1>

          <TrendingCollectionsCarousel
            variant="landing"
            className="max-sm:!my-2 max-sm:w-full sm:mx-auto sm:mt-0"
          />
        </div>

        <div
          className="landing-enter flex w-full max-w-xl shrink-0 flex-col items-stretch gap-2 pt-4 max-sm:pt-5 sm:mt-12 sm:flex-row sm:items-center sm:justify-center sm:gap-4 sm:pt-0"
          style={{ "--landing-enter-delay": "190ms" } as CSSProperties}
        >
          <Link
            href="/markets"
            className="inline-flex min-w-[200px] items-center justify-center rounded-full bg-mint px-7 py-2.5 text-center text-base font-bold text-[#030712] shadow-lg shadow-mint/15 transition hover:brightness-110 hover:shadow-mint/25 active:scale-[0.98] max-sm:w-full max-sm:min-h-[44px] sm:min-w-[220px] sm:py-3.5"
          >
            Markets
          </Link>
          <button
            type="button"
            onClick={navigateToVault}
            className="inline-flex min-w-[200px] items-center justify-center rounded-full border-2 border-mint/70 bg-transparent px-7 py-2.5 text-center text-base font-semibold text-white transition hover:border-mint hover:bg-mint/10 active:scale-[0.98] max-sm:w-full max-sm:min-h-[44px] sm:min-w-[220px] sm:py-3.5"
          >
            Start Selling
          </button>
        </div>
      </section>

      <LandingOffersSection />

      <MarketIndexes />

      <footer
        className="landing-enter relative z-10 border-t border-gray-800/60 py-8 text-center text-xs text-gray-600"
        style={{ "--landing-enter-delay": "340ms" } as CSSProperties}
      >
        &copy; {new Date().getFullYear()} Tokenable. All rights reserved.
      </footer>
    </div>
  );
}
