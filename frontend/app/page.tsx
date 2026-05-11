"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { TrendingCollectionsCarousel } from "@/components/landing/TrendingCollectionsCarousel";
import { ASSETS } from "@/constants/assets";

/**
 * Reference: teal “aurora” blobs — soft top-right / bottom-right wash.
 */
const AURORA_ORBS: Array<{
  top: string;
  left: string;
  size: number;
  blur: number;
  fill: string;
}> = [
  { top: "10%", left: "82%", size: 300, blur: 110, fill: "rgba(45, 212, 191, 0.16)" },
  { top: "76%", left: "78%", size: 420, blur: 128, fill: "rgba(20, 184, 166, 0.12)" },
  { top: "38%", left: "6%", size: 220, blur: 96, fill: "rgba(0, 255, 170, 0.09)" },
  { top: "52%", left: "48%", size: 160, blur: 88, fill: "rgba(148, 255, 212, 0.06)" },
];

const LANDING_ORB_DURATIONS_S = [28, 32, 26, 34];

function AmbientAurora() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      {AURORA_ORBS.map((o, i) => (
        <div
          key={i}
          className="landing-orb-host absolute"
          style={{ top: o.top, left: o.left }}
        >
          <div
            className="landing-orb-inner"
            style={{
              width: o.size,
              height: o.size,
              background: o.fill,
              filter: `blur(${o.blur}px)`,
              animationDuration: `${LANDING_ORB_DURATIONS_S[i] ?? 30}s`,
              animationDelay: `${i * 1.6}s`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function FeeBadgeIcons() {
  return (
    <div className="flex items-center justify-center" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSETS.icons.lowestFees}
        alt=""
        width={78}
        height={78}
        className="h-11 w-11 object-contain grayscale saturate-0 sm:h-12 sm:w-12"
      />
    </div>
  );
}

function GemsOnlyIcon() {
  return (
    <div className="flex items-center justify-center" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSETS.icons.gemsOnly}
        alt=""
        width={78}
        height={78}
        className="h-11 w-11 object-contain grayscale saturate-0 sm:h-12 sm:w-12"
      />
    </div>
  );
}

function VaultedAuthenticatedIcon() {
  return (
    <div className="flex items-center justify-center" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSETS.icons.vaultedAuthenticated}
        alt=""
        width={78}
        height={78}
        className="h-11 w-11 object-contain grayscale saturate-0 sm:h-12 sm:w-12"
      />
    </div>
  );
}

/** Shared height + bottom alignment so stat rows and captions line up across columns. */
function FeatureStat({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex w-full min-h-[3.5rem] shrink-0 items-end justify-center sm:min-h-[4rem]">
        {children}
      </div>
      <span className="mt-3 text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-mint sm:text-xs">
        {label}
      </span>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060708] text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#07080c] via-[#060708] to-[#030304]" />

      <AmbientAurora />

      <div
        className="landing-grid-drift pointer-events-none absolute inset-0 z-[2] opacity-[0.035]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(148,255,212,0.4) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Hero — mobile: fill space under header so Markets + Start Selling stay in first viewport */}
      <section className="relative z-10 flex flex-col max-sm:min-h-[calc(100svh-3.75rem)] max-sm:px-4 max-sm:pt-6 max-sm:pb-5 sm:items-center sm:px-6 sm:pt-28 sm:pb-20">
        <div className="flex w-full flex-col items-center max-sm:flex-1 max-sm:justify-center max-sm:gap-2 max-sm:[min-height:0]">
          <h1
            className="landing-enter mb-2 max-w-4xl text-center text-[1.48rem] font-bold leading-[1.18] tracking-tight text-white max-sm:px-1 sm:mb-5 sm:text-4xl sm:leading-tight md:text-5xl lg:text-[3.25rem] lg:leading-[1.12]"
            style={{ "--landing-enter-delay": "0s" } as CSSProperties}
          >
            Tokenized Collectibles Markets
          </h1>

          <p
            className="landing-enter mb-3 max-w-xl text-center text-[12px] leading-snug text-gray-400 sm:mb-8 sm:text-base sm:leading-relaxed"
            style={{ "--landing-enter-delay": "70ms" } as CSSProperties}
          >
            Instant settlement and low fees.
            <br />
            Vaulted and Authenticated PSA, TAG, and BGS Gems.
          </p>

          <TrendingCollectionsCarousel
            variant="landing"
            className="landing-enter max-sm:!my-1 max-sm:w-full max-sm:flex-1 max-sm:[min-height:0] sm:mx-auto sm:mt-0"
            outerStyle={
              {
                "--landing-enter-delay": "130ms",
              } as CSSProperties
            }
          />
        </div>

        <div
          className="landing-enter mt-auto flex w-full max-w-xl shrink-0 flex-col items-stretch gap-2 pt-3 max-sm:pt-4 sm:mt-12 sm:flex-row sm:items-center sm:justify-center sm:gap-4 sm:pt-0"
          style={{ "--landing-enter-delay": "190ms" } as CSSProperties}
        >
          <Link
            href="/markets"
            className="inline-flex min-w-[200px] items-center justify-center rounded-full bg-mint px-7 py-2.5 text-center text-base font-bold text-[#030712] shadow-lg shadow-mint/15 transition hover:brightness-110 hover:shadow-mint/25 active:scale-[0.98] max-sm:w-full max-sm:min-h-[44px] sm:min-w-[220px] sm:py-3.5"
          >
            Markets
          </Link>
          <Link
            href="/vault"
            className="inline-flex min-w-[200px] items-center justify-center rounded-full border-2 border-mint/70 bg-transparent px-7 py-2.5 text-center text-base font-semibold text-white transition hover:border-mint hover:bg-mint/10 active:scale-[0.98] max-sm:w-full max-sm:min-h-[44px] sm:min-w-[220px] sm:py-3.5"
          >
            Start Selling
          </Link>
        </div>
      </section>

      {/* Feature stats */}
      <section className="landing-stats-stagger relative z-10 mx-auto max-w-5xl border-t border-white/[0.06] px-6 py-16 sm:py-20">
        <div className="grid grid-cols-2 items-start gap-x-8 gap-y-12 sm:gap-x-10 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-0">
          <FeatureStat label="Collectibles Market">
            <span className="text-3xl font-extrabold tracking-tight text-white tabular-nums sm:text-4xl">
              $10B
            </span>
          </FeatureStat>

          <FeatureStat label="Lowest Fees">
            <FeeBadgeIcons />
          </FeatureStat>

          <FeatureStat label="PSA, TAG, BGS Gems Only">
            <GemsOnlyIcon />
          </FeatureStat>

          <FeatureStat label="100% Vaulted & Authenticated">
            <VaultedAuthenticatedIcon />
          </FeatureStat>
        </div>
      </section>

      <footer
        className="landing-enter relative z-10 border-t border-gray-800/60 py-8 text-center text-xs text-gray-600"
        style={{ "--landing-enter-delay": "340ms" } as CSSProperties}
      >
        &copy; {new Date().getFullYear()} Tokenable. All rights reserved.
      </footer>
    </div>
  );
}
